FROM node:22-bookworm-slim

WORKDIR /app

COPY . .

RUN npm install
RUN npm install --workspace identity-provider --no-save lightningcss-linux-x64-gnu@1.31.1 @tailwindcss/oxide-linux-x64-gnu@4.2.1
RUN npm run build --workspace identity-provider

EXPOSE 3001

CMD ["npm", "run", "start", "--workspace", "identity-provider", "--", "--hostname", "0.0.0.0", "--port", "3001"]
