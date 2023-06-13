import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDevUrl } from "../utils";
const Home = () => {
  const [channels, setChannels] = useState([] as string[]);
  const fetchAvailableChannels = () => {
    fetch(getDevUrl("/api/get-topics-list"))
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        setChannels(data);
      });
  };

  useEffect(() => {
    fetchAvailableChannels();
  }, []);

  return channels.length ? (
    <ul>
      {channels.map((channelName, i) => (
        <li key={`channel-${i}`}>
          <Link to={`/channel/${channelName}`}>{channelName}</Link>{" "}
        </li>
      ))}
    </ul>
  ) : (
    <div>Loading list of channels...</div>
  );
};

export default Home;
