import cors from "cors";
import { config } from "dotenv";
import express, { Request, Response } from "express";
import session from "express-session";
import { join } from "path";
import sanitizeHtml from "sanitize-html";
import fileStore from "session-file-store";

import { faker } from "@faker-js/faker";
import { Message } from "@google-cloud/pubsub";

import ChannelListener from "./channelListener";

import pubSubClient, {
  getOrCreateSubscription,
  getTopics,
} from "./pub-sub-client";

interface ChatUser {
  name: string;
}

interface ChatMessage {
  author: ChatUser;
  message: string;
  timestamp: Date;
}

interface ChatIncomingMessage {
  message: string;
}

config();
const app = express();
const port = process.env.PORT;

app.use(express.json());
app.use(express.static(join(__dirname, "front")));

const FileStore = fileStore(session);
app.use(
  session({
    genid: () =>
      faker.helpers.slugify(
        `${faker.color.human()} ${faker.animal.type()} ${faker.number.hex()}`
      ),
    secret: process.env.COOKIE_SECRET,
    store: new FileStore(),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

app.use(cors());

app.get("/api/get-topics-list", async (req: Request, res: Response) => {
  res.send(await getTopics());
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


/*
  We are using SSE to communicate with client. 
  Only one subscription for whole channel and multiple users. PP - Not sure if this is good approach but I dont see downsides
  Channel names are input, where subscription name is based on channel name.
*/
app.get("/api/channel/:id", async (req: Request, res: Response) => {
  const topicName = req.params.id;
  try {
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders(); // flush the headers to establish SSE with client

    // pp - copied from stackow
    // function to send server sent events (sse)
    const sendSSE = data => {
      const dataToSend = JSON.stringify(data);

      console.log(`sendSSE ${dataToSend}`);

      res.write(`data: ${dataToSend}`);
      res.write("\n\n");

      // this is the important part if using the compression npm module
      res.flushHeaders();
    };

    const onMsgFunc = (msg: ChatMessage) => {
      console.log("onMsgFunc of request", msg);
      if (msg == null) {
        return;
      }

      sendSSE(msg);
    };

    const listener = ChannelListener.getInstance();
    
    setInterval(() => {
      sendSSE({ message: {} });
    }, 5000);

    res.on("close", () => {
      console.log("client dropped me");
      listener.unlistenChannel(topicName, onMsgFunc);
      res.end();
    });

    const history = await listener.listenChannel(topicName, onMsgFunc);
    history.forEach(msg => sendSSE(msg));
  } catch (e) {
    console.log("error", e);
    res.status(404).send(e);
  }
});

app.post("/api/channel/:id", async (req: Request, res: Response) => {
  const topicName = req.params.id;
  const topic = pubSubClient.topic(topicName, { messageOrdering: false });

  const requestJson = req.body as ChatIncomingMessage;
  if (requestJson.message == null) {
    console.error(
      "received empty message or badly formated data in post/channel/id"
    );
    return;
  }

  // we might get rid of this checking in future, as it for large amount of users this might have impact (additional request per each message)
  const [isTopicAvailable] = await topic.exists();
  if (isTopicAvailable) {
    const message = {
      author: {
        name: req.session.id,
      },
      message: sanitizeHtml(requestJson.message),
      timestamp: new Date(),
    } as ChatMessage;

    console.log("publishing message", message);

    const result = await topic.publishMessage({ json: message });
    console.log("message published:", result);
    res.status(200).send("OK");
  } else {
    console.error(`channel/topic with id ${topicName} not found`);
    res.status(404).send();
  }
});

app.get("/api/get-my-name", (req: Request, res: Response) => {
  res.send(req.session.id);
});

app.get("*", async (req: Request, res: Response) => {
  res.sendFile(join(__dirname, "front", "index.html"));
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
