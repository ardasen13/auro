FROM node:18

WORKDIR /app

RUN npm install express express-http-proxy express-rate-limit request-ip

COPY . .

EXPOSE 7860

CMD [ "node", "server.js" ]