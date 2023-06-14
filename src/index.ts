import pubSubClient from "./pub-sub-client";
import { faker } from '@faker-js/faker';
import express, { Request, Response } from "express";
import { config } from "dotenv";
import { Message, Subscription, Topic } from "@google-cloud/pubsub";
import { join } from "path";
import sanitizeHtml from "sanitize-html";
import session from "express-session";
import fileStore from "session-file-store";
import cors from "cors";

// Augment express-session with a custom SessionData object
declare module "express-session" {
  interface SessionData {
    userName: string;
  }
}


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
    secret: process.env.COOKIE_SECRET,
    store: new FileStore(),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

app.use(cors());

app.get("/api/get-topics-list", async (req: Request, res: Response) => {
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

async function getOrCreateSubscription(
  channelName: string
): Promise<Subscription | null> {
  const subName = `subscription-for-channel-${channelName}`;

  try {
    const subscription = pubSubClient.subscription(subName);
    const [isSubscriptionActive] = await subscription.exists();

    if (isSubscriptionActive) {
      return subscription;
    }

    return createSubscription(channelName, subName);
  } catch (error) {
    console.error("unknown error when getting subscription", error);
    return null;
  }
}

async function createSubscription(
  channelName: string,
  subscriptionName: string
): Promise<Subscription | null> {
  try {
    console.log("creating subscription");
    const [result] = await pubSubClient.createSubscription(
      channelName,
      subscriptionName,
      {
        enableMessageOrdering: true
      }
    );

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
    console.error("received empty message or badly formated data in post/channel/id");
    return;
  }

  // we might get rid of this checking in future, as it for large amount of users this might have impact (additional request per each message)
  const [isTopicAvailable] = await topic.exists();
  const hasUserName = req.session.userName != null;

  if (isTopicAvailable && hasUserName) {
    const message = {
      author: {
        name: req.session.userName
      },
      message: sanitizeHtml(requestJson.message),
      timestamp: new Date()
    } as ChatMessage

    await topic.publishMessage({ json: message });
    res.status(200).send();
  } else {
    if (!hasUserName) {
      res.status(500).send("user name not initialized");
    } else {
      console.error(`channel/topic with id ${topicName} not found`);
      res.status(404).send();
    }
  }
});

app.get("/api/get-my-name", (req: Request, res: Response) => {
  if (req.session.userName == null) {
    req.session.userName = faker.animal.dog();
  }

  res.send(req.session.userName);
});

app.get("*", async (req: Request, res: Response) => {
  res.sendFile(join(__dirname, "front", "index.html"));
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
