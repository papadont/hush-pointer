import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";

const packageJson=JSON.parse(readFileSync(new URL("./package.json",import.meta.url),"utf-8")) as {version:string};

export default defineConfig({
  define:{
    __APP_VERSION__:JSON.stringify(packageJson.version),
  },
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    tailwindcss(),
  ],
  base: '/hush-pointer/' 
});
