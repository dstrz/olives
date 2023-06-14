import { EventEmitter } from 'events';
import { getOrCreateSubscription } from "./pub-sub-client";
import sanitizeHtml from "sanitize-html";
import { Message, Subscription } from '@google-cloud/pubsub';

const MaxMessageCacheLength = 50;

interface ChatUser {
    name: string;
}

interface ChatMessage {
    author: ChatUser;
    message: string;
    timestamp: string;
}

interface ChannelSub {
    channelName: string;
    sub: Subscription;
    emitter: EventEmitter
    messageCache: ChatMessage[];
    lastAccessed: Date;
    clients: number;
}

function extractMessageFromEventData(event: Message) {
    if (event.data == null) {
        return null;
    }

    try {
        const chatMessage = JSON.parse(event.data.toString()) as ChatMessage;
        if (chatMessage.author == null || chatMessage.message == null) {
            console.log("received invalid message from sub, skipping", event);
            return null;
        }

        chatMessage.message = sanitizeHtml(chatMessage.message);
        return chatMessage;
    } catch (e) {
        // console.log("failed to parse message:", e, event);
    }

    return null;
}

class ChannelListener {
    private static _instance: ChannelListener;
    static getInstance() {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new ChannelListener();
        return this._instance;
    }

    private _channelSub = [] as ChannelSub[];

    public async listenChannel(channelName: string, listenerFunc: (...args: any[]) => void) {
        console.log("listenChannel start")

        let subWrapper = this._channelSub.find(wrapper => wrapper.channelName == channelName);
        if (subWrapper == null) {
            console.log("listenChannel no sub, creating");
            subWrapper = await this.prepareChannelForListening(channelName);
            if (subWrapper == null) {
                throw `couldn't listen for channel ${channelName}`;
            }
        }

        console.log("listenChannel registering");

        subWrapper.emitter.on("message", listenerFunc);
        subWrapper.lastAccessed = new Date();
        ++subWrapper.clients;
        return subWrapper.messageCache.sort((a: ChatMessage, b: ChatMessage) => new Date(a.timestamp).getTime()- new Date(b.timestamp).getTime());
    }

    unlistenChannel(channelName: string, listenerFunc: (...args: any[]) => void) {
        console.log("unlistenChannel");

        const subWrapper = this._channelSub.find(wrapper => wrapper.channelName == channelName);
        if (subWrapper) {
            subWrapper.emitter.removeListener("message", listenerFunc);
            subWrapper.lastAccessed = new Date();
            --subWrapper.clients;
        }

        // write some nice stuff to cleanup with no clients;
    }

    private async prepareChannelForListening(channelName: string) {
        const sub = await getOrCreateSubscription(channelName);
        if (sub == null) {
            return;
        }

        let isPreloading = true;

        const subObject = {
            sub,
            channelName,
            emitter: new EventEmitter(),
            lastAccessed: new Date(),
            clients: 0,
            messageCache: [] as ChatMessage[]
        } as ChannelSub;

        const historyListener = (event: Message) => {
            const message = extractMessageFromEventData(event);
            console.log(`hello from historyListener for '${channelName}'. Message: '${message != null ? JSON.stringify(message) : "null"}'`)
            
            if(isPreloading) {
                console.log("is preloading, not emitting");
            } else {
                subObject.emitter.emit("message", message);
            }

            if (message != null) {
                subObject.messageCache.push(message);
                if (subObject.messageCache.length > MaxMessageCacheLength) {
                    subObject.messageCache.shift();
                }
            }
        }

        this._channelSub.push(subObject);
        sub.addListener("message", historyListener);

        // dirty hack to fake a clean history
        // note that tihs will still create race condition anyways
        await new Promise(resolve => setTimeout(resolve, 3000));
        isPreloading = false;
        console.log("done preload...");

        return subObject;
    }
}


export default ChannelListener;