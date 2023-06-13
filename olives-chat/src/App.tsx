import React, { useState, useEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import "./App.css";
import { getDevUrl } from "./utils";

const App: React.FC<React.PropsWithChildren> = () => {
  const [name, setName] = useState("");
  useEffect(() => {
    fetch(getDevUrl("/api/get-my-name")).then((response) =>
      response.text().then(setName)
    );
  }, []);
  return (
    <div className="column">
      <header>
        <Link className="header-link" to="/">
          Olives Chat
        </Link>
        <div className="user-name">Your temporary name is {name}</div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default App;
