# Olives Chat

Hackathon chat application that utilizes Google Cloud Pub/Sub API.

Developed on NodeJS version `18.10.0`

create `.env` file in root directory with e.g. PORT value to host app on `localhost:<PORT>`

start with
`npm i` command to install dependencies

then run:
`npm run build`

That will build front app and copy static files to .dist directory.

To develop backend API you can run:
`npm run dev`
which should run nodemon process that watches changes to files and restarts server automatically during development
