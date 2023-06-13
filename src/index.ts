import pubSubClient from "./pub-sub-client";
import express, { Request, Response } from "express";
import { config } from "dotenv";
import { Message, Subscription, Topic } from "@google-cloud/pubsub";
import { join } from "path";
import sanitizeHtml from 'sanitize-html';
import { StatusError } from "@google-cloud/pubsub/build/src/message-stream";

interface ChatUser {
  name: string;
}

interface ChatMessage {
  author: ChatUser;
  message: string;
  timestamp: Date;
}

const testMessage = {
  author: {
    name: "test-pp-gdc"
  },
  message: "message-test-1",
  timestamp: new Date()
}

config();
const app = express();
const port = process.env.PORT;
app.use(express.static(join(__dirname, "front")));

app.get("/api/get-topics-list", async (req: Request, res: Response) => {

  console.log("get-topics-list");
  const topics = await pubSubClient
    .getTopics()
    .then((response) =>
      response.flatMap((x: Topic[]) => x.map((t) => t.name.split("/").at(-1)))
    );
  res.send(topics);
});

app.get("/api/create-topic/:id", async (req: Request, res: Response) => {
  const topicName = req.params.id;
  try {
    await pubSubClient.createTopic(topicName);
    res.send(`created topic ${topicName}`);
  } catch (e) {
    res.status(409).send(e.details);
  }
});


function extractMessageFromEventData(event: Message) {
  if (event.data == null) {
    return null;
  }

  try {
    const chatMessage = JSON.parse(event.data.toString()) as ChatMessage;
    if (chatMessage.author == null || chatMessage.message == null) {
      console.log("received invalid message from sub, skipping", event)
      return null;
    }

    chatMessage.message = sanitizeHtml(chatMessage.message);
    return chatMessage;

  } catch (e) {
    console.log("failed to parse message:", e, event)
  }

  return null;
}

async function getOrCreateSubscription(channelName: string): Promise<Subscription | null> {
  const subName = `subscription-for-channel-${channelName}`;

  try {
    const subscription = pubSubClient.subscription(subName);

    console.log("getting sub status...");
    const isSubscriptionActive = await subscription.exists();

    console.log("getting sub status result", isSubscriptionActive);

    if (isSubscriptionActive[0]) {
      return subscription;
    }

    return createSubscription(channelName, subName);
  } catch (error) {
    console.error("unknown error when getting subscription", error);
    return null;
  }
}

async function createSubscription(channelName: string, subscriptionName: string): Promise<Subscription | null> {
  try {
    console.log("creating subscription");
    const [result] = await pubSubClient.createSubscription(channelName, subscriptionName);

    return result;
  } catch (error) {
    console.error("failed to create subscription", error);
  }

  return null;
}

/*
  We are using SSE to communicate with client. 
  Only one subscription for whole channel and multiple users. PP - Not sure if this is good approach but I dont see downsides
  Channel names are input, where subscription name is based on channel name.
*/
app.get("/api/channel/:id", async (req: Request, res: Response) => {
  const topicName = req.params.id;
  try {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // flush the headers to establish SSE with client

    // todo: better error handling maybe
    const subscription = await getOrCreateSubscription(topicName);
    if (subscription == null) {
      res.status(404);
      return;
    }

    subscription.on("message", (event: Message) => {
      const message = extractMessageFromEventData(event);

      if (message != null) {
        res.write(`${JSON.stringify(message)}\r\n`);
      }
    });

    // If client closes connection, stop sending events
    res.on('close', () => {
      console.log('client dropped me');
      subscription.close();
      res.end();
    });

  } catch (e) {
    console.log("error", e);
    res.status(404).send(e);
  }
});

app.get("*", async (req: Request, res: Response) => {
  console.log("rooot");
  res.sendFile(join(__dirname, "front", "index.html"));
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
