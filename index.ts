import { PubSub } from "@google-cloud/pubsub";

const projectId = "hackathon-team-5-388910";
const topicNameOrId = "test-topic";
const subscriptionName = "test-sub";

const pubSubClient = new PubSub({
  projectId,
});

(async () => {
  const [topic] = await pubSubClient.createTopic(topicNameOrId);
  console.log(`Topic ${topic.name} created.`);

  // Creates a subscription on that new topic
  const [subscription] = await topic.createSubscription(subscriptionName);

  // Receive callbacks for new messages on the subscription
  subscription.on("message", (message) => {
    console.log("Received message:", message.data.toString());
    process.exit(0);
  });

  // Receive callbacks for errors on the subscription
  subscription.on("error", (error) => {
    console.error("Received error:", error);
    process.exit(1);
  });

  // Send a message to the topic
  topic.publishMessage({ data: Buffer.from("Test message!") });
})();
