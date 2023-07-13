import { ChatOpenAI } from "langchain/chat_models/openai";
import { CallbackManager } from "langchain/callbacks";
import { BufferMemory, ChatMessageHistory } from "langchain/memory";
import {
  AIChatMessage,
  BaseChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "langchain/schema";
import { NextResponse } from "next/server";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { SupabaseVectorStore } from "langchain/vectorstores/supabase";
import { createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

export const runtime = "edge";



function mapStoredMessagesToChatMessages(
  messages: BaseChatMessage[]
): BaseChatMessage[] {
  return messages.map((message) => {
    switch (message.name) {
      case "human":
        return new HumanChatMessage(message.text);
      case "ai":
        return new AIChatMessage(message.text);
      case "system":
        return new SystemChatMessage(message.text);
      default:
        throw new Error("Role must be defined for generic messages");
    }
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const question = body.prompt;
  const messages = body.messages;
  const model = body.model;
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  
  let counter = 0;
  let string = "";
  
  const chat = new ChatOpenAI({
    modelName: model,
    temperature: 0,
    streaming: true,
    maxRetries: 1,
    callbackManager: CallbackManager.fromHandlers({
      handleLLMNewToken: async (token: string, runId, parentRunId) => {
        await writer.ready;
        string += token;
        counter++;
        await writer.write(encoder.encode(`${token}`));
      },
      handleLLMEnd: async () => {
        await writer.ready;
        await writer.close();
      },
      handleLLMError: async (e) => {
        await writer.ready;
        console.log("handleLLMError Error: ", e);
        await writer.abort(e);
      },
    }),
  });
  const lcChatMessageHistory = new ChatMessageHistory(
    mapStoredMessagesToChatMessages(messages)
  );
  const chat_history = new BufferMemory({
    chatHistory: lcChatMessageHistory,
    returnMessages: true,
    memoryKey: "history",
  });
  
  
  const privateKey = process.env.SUPABASE_KEY;
  if (!privateKey) throw new Error(`Expected env var SUPABASE_PRIVATE_KEY`);

  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error(`Expected env var SUPABASE_URL`);

  const client = createClient(url, privateKey,{
    auth:{
      persistSession:false
    }
  },);

  const supabase_table=process.env.SUPABASE_TABLE || "";

  const vectorStore = await SupabaseVectorStore.fromExistingIndex(
    new OpenAIEmbeddings(),
    {
      client,
      tableName: supabase_table  || "",

    }
  )

  // const client = new PineconeClient();
  // await client.init({
  //   apiKey: process.env.PINECONE_API_KEY || "",
  //   environment: process.env.PINECONE_ENV || "",
  // });
  // const pineconeIndex = client.Index(process.env.PINECONE_INDEX || "");

  // const vectorStore = await PineconeStore.fromExistingIndex(
  //   new OpenAIEmbeddings({
  //     openAIApiKey: process.env.OPENAI_API_KEY,
  //   }),
  //   { pineconeIndex }
  // );

  const chain = ConversationalRetrievalQAChain.fromLLM(
    chat,
    vectorStore.asRetriever(),
  )
   
  chain.call({
    question,
    chat_history,
    
  });

  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
    },
  });
}
