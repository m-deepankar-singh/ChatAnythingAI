"use client";
import { Message } from "@/components/Message";
import SendIcon from "@/components/SendIcon";
import Spinner from "@/components/Spinner";
import ScrollToBottom from "react-scroll-to-bottom";
import { useEffect, useReducer, useRef, KeyboardEvent } from "react";
import TextareaAutosize from "react-textarea-autosize";
import React, { useState } from "react";
import Modal from "react-modal";
import FileUpload from "@/components/FileUpload";
import axios from "axios";
import UrlProcessor from "@/components/url";
import URLProcessor from "@/components/url";
import { GitProcessor } from "@/components/git";
import { YTProcessor } from "@/components/youtube";

Modal.setAppElement("#root");

const modalStyles = {
  overlay: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  content: {
    color: "lightsteelblue",
    width: "50%", // Adjust the width as needed
    height: "50%", // Adjust the height as needed
    top: "25%", // Adjust the vertical position as needed
    left: "25%", // Adjust the horizontal position as needed
    border: "none", // Remove the border
    background: "#111827", // Set background color, adjust as needed
    borderRadius: "20px", // Set the border radius, adjust as needed
    padding: "20px", // Add padding inside the modal
  },
};

interface Message {
  name: "human" | "ai" | "system";
  text: string;
}

interface AppState {
  messages: Message[] | [];
  assistantThinking: boolean;
  isWriting: boolean;
  controller: AbortController | null;
}

type AddMessage = {
  type: "addMessage";
  payload: { prompt: string; controller: AbortController };
};
type UpdatePromptAnswer = { type: "updatePromptAnswer"; payload: string };
type Abort = { type: "abort" };
type Done = { type: "done" };
type AppActions = AddMessage | UpdatePromptAnswer | Abort | Done;

function reducer(state: AppState, action: AppActions): AppState {
  switch (action.type) {
    case "addMessage":
      return {
        ...state,
        assistantThinking: true,
        messages: [
          ...state.messages,
          { name: "human", text: action.payload.prompt },
          { name: "ai", text: "" },
        ],
        controller: action.payload.controller,
      };
    case "updatePromptAnswer":
      const conversationListCopy = [...state.messages];
      const lastIndex = conversationListCopy.length - 1;
      conversationListCopy[lastIndex] = {
        ...conversationListCopy[lastIndex],
        text: conversationListCopy[lastIndex].text + action.payload,
      };

      return {
        ...state,
        assistantThinking: false,
        isWriting: true,
        messages: conversationListCopy,
      };
    case "abort":
      state.controller?.abort();
      return {
        ...state,
        isWriting: false,
        assistantThinking: false,
        controller: null,
      };
    case "done":
      return {
        ...state,
        isWriting: false,
        assistantThinking: false,
        controller: null,
      };
    default:
      return state;
  }
}

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const [isUrlProcessorModalOpen, setIsUrlProcessorModalOpen] = useState(false);
  const openUrlProcessorModal = () => setIsUrlProcessorModalOpen(true);
  const closeUrlProcessorModal = () => setIsUrlProcessorModalOpen(false);

  const [isGitProcessorModalOpen, setIsGitProcessorModalOpen] = useState(false);
  const openGitProcessorModal = () => setIsGitProcessorModalOpen(true);
  const closeGitProcessorModal = () => setIsGitProcessorModalOpen(false);

  const [isYTProcessorModalOpen, setIsYTProcessorModalOpen] = useState(false);
  const openYTProcessorModal = () => setIsYTProcessorModalOpen(true);
  const closeYTProcessorModal = () => setIsYTProcessorModalOpen(false);

  const [model, setModel] = useState("gpt-3.5-turbo");
  const [isModelSelectDisabled, setIsModelSelectDisabled] = useState(false);

  const [state, dispatch] = useReducer(reducer, {
    messages: [],
    assistantThinking: false,
    isWriting: false,
    controller: null,
  });

  const promptInput = useRef<HTMLTextAreaElement>(null);

  const handleDeleteContext = async () => {
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_BACKEND_URL}/delete`);
      alert("Context deleted successfully");
      window.location.reload();
    } catch (error) {
      alert("Error deleting context");
    }
  };

  const handlePrompt = async () => {
    if (promptInput && promptInput.current) {
      const prompt = promptInput.current.value;
      if (prompt !== "") {
        const controller = new AbortController();
        const signal = controller.signal;
        dispatch({ type: "addMessage", payload: { prompt, controller } });
        promptInput.current.value = "";

        setIsModelSelectDisabled(true);

        const res = await fetch(`/api/chat`, {
          method: "POST",
          body: JSON.stringify({ messages: state.messages, prompt, model }),
          signal: signal,
        });
        const data = res.body;
        if (!data) {
          return;
        }

        const reader = data.getReader();
        const decoder = new TextDecoder();
        let done = false;

        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;

          const chunkValue = decoder.decode(value);
          dispatch({ type: "updatePromptAnswer", payload: chunkValue });
        }
        if (done) {
          dispatch({ type: "done" });
        }
      }
    }
  };

  const handlePromptKey = async (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handlePrompt();
    }
  };

  const handleAbort = () => {
    dispatch({ type: "abort" });
  };

  // focus input on page load
  useEffect(() => {
    if (promptInput && promptInput.current) {
      promptInput.current.focus();
    }
  }, []);

  return (
    <div className="flex h-full relative flex-1 flex-col">
      <main className="relative h-full w-full transition-width flex flex-col overflow-hidden items-stretch max-w-3xl ml-auto mr-auto pb-12 font-default">
        <div className="flex-1 overflow-hidden ">
          <ScrollToBottom
            className="relative h-full pb-14 pt-6"
            scrollViewClassName="h-full overflow-y-auto"
          >
            <div className="w-full transition-width flex flex-col items-stretch flex-1">
              <div className="flex-1">
                <div className="flex items-start py-8  justify-center">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="rounded w-64 bg-indigo-50 text-indigo-600 py-1 px-2 text-sm font-semibold shadow-sm hover:bg-gray-100"
                    disabled={isModelSelectDisabled}
                  >
                    <option value="gpt-3.5-turbo">GPT-3.5-Turbo</option>
                    <option value="gpt-4">GPT-4</option>
                  </select>
                </div>

                <div className="flex flex-col prose prose-lg prose-invert">
                  {state.messages.map((message, i) => (
                    <Message
                      key={i}
                      name={message.name}
                      text={message.text}
                      thinking={state.assistantThinking}
                    />
                  ))}
                </div>
              </div>
            </div>
          </ScrollToBottom>
        </div>
        <div className="relative mb-0  w-full px-1">
          {(state.assistantThinking || state.isWriting) && (
            <div className="flex mx-auto justify-center mb-2">
              <button
                type="button"
                className="rounded mb-4 bg-indigo-50 py-1 px-2 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100"
                onClick={handleAbort}
              >
                Stop generating
              </button>
            </div>
          )}
          <div className="flex space-x-4 ">
            <button
              onClick={openModal}
              className="rounded mb-4 bg-indigo-50 py-1 px-2 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100"
            >
              Upload Files
            </button>
            <button
              onClick={openUrlProcessorModal}
              className="rounded mb-4 bg-indigo-50 py-1 px-2 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100"
            >
              Add URLs
            </button>
            {/* <button
              onClick={openGitProcessorModal}
              className="rounded mb-4 bg-indigo-50 py-1 px-2 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100"
            >
              Add GitHub Repo
            </button> */}
            <button
              onClick={openYTProcessorModal}
              className="rounded mb-4 bg-indigo-50 py-1 px-2 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100"
            >
              Add YouTube URL
            </button>
          </div>
          <Modal
            isOpen={isModalOpen}
            onRequestClose={closeModal}
            contentLabel="File Upload Modal"
            style={modalStyles}
          >
            <FileUpload />
          </Modal>
          <Modal
            isOpen={isUrlProcessorModalOpen}
            onRequestClose={closeUrlProcessorModal}
            contentLabel="URL Processor Modal"
            style={modalStyles}
          >
            <URLProcessor />
          </Modal>
          <Modal
            isOpen={isGitProcessorModalOpen}
            onRequestClose={closeGitProcessorModal}
            contentLabel="Git Processor Modal"
            style={modalStyles}
          >
            <GitProcessor />
          </Modal>
          <Modal
            isOpen={isYTProcessorModalOpen}
            onRequestClose={closeYTProcessorModal}
            contentLabel="YT Processor Modal"
            style={modalStyles}
          >
            <YTProcessor />
          </Modal>

          <div className="relative flex flex-col w-full p-3  bg-gray-800 rounded-md shadow ring-1 ring-gray-200 dark:ring-gray-600 focus-within:ring-2 focus-within:ring-inset dark:focus-within:ring-indigo-600 focus-within:ring-indigo-600">
            <label htmlFor="prompt" className="sr-only">
              Prompt
            </label>
            <div className="flex items-center">
              <button
                type="button"
                className="rounded bg-red-500 py-1 px-2 text-sm font-semibold text-white shadow-sm hover:bg-red-600 mr-2"
                onClick={handleDeleteContext}
              >
                Delete Context
              </button>
              <TextareaAutosize
                ref={promptInput}
                name="prompt"
                id="prompt"
                rows={1}
                maxRows={6}
                onKeyDown={handlePromptKey}
                className="m-0 w-full resize-none border-0 bg-transparent  pr-7 focus:ring-0 focus-visible:ring-0 dark:bg-transparent text-gray-800 dark:text-gray-50 text-base"
                placeholder="Type something..."
                defaultValue=""
              />
            </div>
            <div className="absolute right-3 top-[calc(50%_-_10px)]">
              {state.assistantThinking || state.isWriting ? (
                <Spinner cx="animate-spin w-5 h-5 text-gray-400" />
              ) : (
                <SendIcon
                  cx="w-5 h-5 text-gray-400 hover:text-gray-500 hover:cursor-pointer"
                  onClick={handlePrompt}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
