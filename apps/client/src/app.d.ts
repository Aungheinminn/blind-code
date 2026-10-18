/// <reference types="sveltejs/kit" />

declare namespace App {}

declare module "*.svg?raw" {
  const content: string;
  export default content;
}
