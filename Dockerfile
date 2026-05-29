FROM node:22

RUN apt-get update && apt-get install -y pandoc

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001

CMD ["node", "server.cjs"]