# A ChatGPT UI. Stream OpenAI responses with Langchain and Nextjs

A complete UI for an OpenAI powered Chatbot inspired by [https://www.ai.com](https://chat.openai.com/).

It makes use of Nextjs streaming responses from the edge. Langchain is used to manage the chat history and calls to OpenAI's chat completion. It uses a basic `BufferMemory` as Memory.

The backend is built with Flask, a popular Python web framework. It handles various document types (like PDF, CSV, DOCX, TXT, etc.), URLs, Git repositories, and YouTube videos. The backend also interfaces with the Pinecone vector database.


Disclaimer: The code in this series is not meant for production or be taken as an example for best practices. It is meant to be be a starting point and conceptual example of how to implement those kind of technologies. There are bugs and no tests! You have been warned! ;)

## Frontend


First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Backend
The backend uses Flask and should be run separately. Before running the backend, make sure to install all dependencies and setup your environment variables, such as AZURE_STORAGE_CONNECTION_STRING, CONTAINER_NAME, PINECONE_API_KEY, PINECONE_ENV.

```bash
# Install dependencies
pip install -r requirements.txt

# Run the backend
python app.py
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
