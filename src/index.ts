import pubSubClient from "./pub-sub-client";
import express, { Request, Response } from "express";
import { config } from "dotenv";
import { Topic } from "@google-cloud/pubsub";
import { join } from "path";

config();
const app = express();
const port = process.env.PORT;
app.use(express.static(join(__dirname, "front")));

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

app.get("api/channel/:id", async (req: Request, res: Response) => {
  const topicName = req.params.id;
  try {
    const channelHistory = [] as string[]; // TODO: fetch channel history to display in client
    const subscriptionName = "test-sub"; // TODO: use some identifier per connected client (cookie?)
    const subscription =
      pubSubClient.subscription(subscriptionName) ||
      (await pubSubClient
        .createSubscription(topicName, "subscriptionName")
        .then((response) => response[0]));

    subscription.on("message", (message) => {
      // TODO: handle client updates (via websocket or SSE?)
      // need to think about what to do with subscription when client disconnects - do we need to delete it?
    });

    res.send(channelHistory);
  } catch (e) {
    res.status(404).send(e);
  }
});

app.get("*", async (req: Request, res: Response) => {
  res.sendFile(join(__dirname, "front", "index.html"));
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
