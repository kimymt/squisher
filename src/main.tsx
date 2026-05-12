import { render } from "preact";
import { App } from "./app";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";

const root = document.getElementById("app");
if (!root) throw new Error("#app element not found");
render(<App />, root);
