import "./styles.css";
import { mountApp } from "./ui/App";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("Elemento #app não encontrado.");
}

mountApp(root);
