FROM node:20-slim

WORKDIR /app

# 複製 package.json，讓 npm 在 Linux 環境重新解析 Linux 原生二進位套件 (避免 Windows 鎖定檔衝突)
COPY package.json ./
RUN npm install --ignore-scripts

COPY . .
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3001

CMD ["npm", "start"]
