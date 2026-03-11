FROM node:22-bookworm-slim

WORKDIR /app

COPY . .

RUN npm install
RUN npm install --workspace identity-consumer --no-save lightningcss-linux-x64-gnu@1.31.1 @tailwindcss/oxide-linux-x64-gnu@4.2.1
RUN npm run build --workspace identity-consumer

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace", "identity-consumer", "--", "--hostname", "0.0.0.0", "--port", "3000"]
