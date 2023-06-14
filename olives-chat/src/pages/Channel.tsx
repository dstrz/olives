import React, {
  useEffect,
  useState,
  useRef,
  KeyboardEvent,
  useContext,
} from "react";
import { useParams } from "react-router-dom";
import NameContext from "../name-context";
import { formatDate, getDevUrl, isDev } from "../utils";

interface ChatUser {
  name: string;
}

interface ChatMessage {
  author: ChatUser;
  message: string;
  timestamp: Date;
}

type Message = {
  user: string;
  date: Date;
  text: string;
};

const Channel = () => {
  const { channelName } = useParams();
  // const user = useContext(NameContext);
  const textRef = useRef<HTMLInputElement>(null);
  const sendMessage = () => {
    const text = textRef.current?.value;
    if (!text) return;

    // if (isDev()) {
    //   // setMessages([...messages, { user, date: new Date(), text }]);
    // } else {
    fetch(getDevUrl(`/api/channel/${channelName}`), {
      method: "POST",
      body: JSON.stringify({ message: text }),
      headers: { "Content-Type": "application/json" },
    }).catch(() => { });
    // }

    textRef.current.value = "";
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      sendMessage();
    }
  };
  const [messages, setMessages] = useState([] as Message[]);

  const fetchChannel = () => {
    const eventSource = new EventSource(
      getDevUrl(`/api/channel/${channelName}`)
    );
    eventSource.onmessage = (ev) => {
      const message = JSON.parse(ev.data) as ChatMessage;
      if (message.author == null) {
        return;
      }

      setMessages((messages) => [
        ...messages,
        {
          date: new Date(message.timestamp),
          text: message.message,
          user: message.author.name,
        },
      ]);
    };
    return () => eventSource.close();
  };

  useEffect(() => {
    return fetchChannel();
  }, []);

  return (
    <>
      <div>{channelName}</div>
      <ul>
        {messages.map((message, i) => (
          <li className="no-bullets" key={`message-${i}`}>
            {formatDate(message.date)} <b>{message.user}</b>: {message.text}
          </li>
        ))}
      </ul>
      <input ref={textRef} onKeyDown={onInputKeyDown} />
      <button onClick={sendMessage}>Send</button>
    </>
  );
};

export default Channel;
