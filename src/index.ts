import cors from "cors";
import { config } from "dotenv";
import express, { Request, Response } from "express";
import session from "express-session";
import { join } from "path";
import sanitizeHtml from "sanitize-html";
import fileStore from "session-file-store";

import { faker } from "@faker-js/faker";
import { Message } from "@google-cloud/pubsub";

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

    // todo: better error handling maybe
    const subscription = await getOrCreateSubscription(topicName);
    if (subscription == null) {
      res.status(404);
      return;
    }

    subscription.on("message", (event: Message) => {
      const message = extractMessageFromEventData(event);

      if (message != null) {
        res.write(`data: ${JSON.stringify(message)}\n\n`);
      }
    });

    // If client closes connection, stop sending events
    res.on("close", () => {
      console.log("client dropped me");
      subscription.close();
      res.end();
    });
  } catch (e) {
    console.log("error", e);
    res.status(404).send(e);
  }
});

app.post("/api/channel/:id", async (req: Request, res: Response) => {
  const topicName = req.params.id;
  const topic = pubSubClient.topic(topicName);

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

    await topic.publishMessage({ json: message });
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
