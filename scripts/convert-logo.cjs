/* eslint-disable @typescript-eslint/no-require-imports */
const sharp = require("sharp");

sharp("public/logo.svg")
  .resize(400, 400)
  .png()
  .toFile("public/logo.png")
  .then(() => console.log("Logo converted"))
  .catch((err) => console.error(err));
