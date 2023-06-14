# Olives Chat

Hackathon chat application that utilizes Google Cloud Pub/Sub API.

Developed on NodeJS version `18.10.0`

## .env file

- create `.env` file in root directory with e.g.`PORT=80` value to host app on `localhost:80`
- add `COOKIE_SECRET` to `.env`

## How to run

start with `npm i` command to install dependencies

then run `npm run build` - that will build front app and copy static files to `dist` directory.

To develop backend API you can run `npm run dev` which should run nodemon process that watches changes to files and restarts server automatically during development
