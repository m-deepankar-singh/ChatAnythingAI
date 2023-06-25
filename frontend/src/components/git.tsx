import React, { ChangeEvent, FC, useState } from "react";
import axios from "axios";
import BeatLoader from "react-spinners/BeatLoader";

export const GitProcessor: FC = () => {
  const [gitUrl, setGitUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [isProcessed, setIsProcessed] = useState<boolean>(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setGitUrl(e.target.value);
  };

  const processGitUrl = async () => {
    setLoading(true);
    try {
      const response = await axios.post("https://chatany.onrender.com/:5000/git", { git_url: gitUrl });
      console.log(response.data);
      setIsProcessed(true);
    } catch (error) {
      console.log(error);
    }
    setLoading(false);
  };

  const resetUrl = () => {
    setGitUrl("");
    setIsProcessed(false);
  };

  return (
    <div className="font-default flex items-center justify-center">
      <div className="flex min-h-fit flex-col items-center justify-center text-white">
        <div className="space-y-4 p-4">
          {!isProcessed && (
            <input
              type="text"
              placeholder="Enter Git URL"
              className="w-full rounded py-2 px-3 text-md font-semibold text-gray-700 shadow-sm"
              value={gitUrl}
              onChange={handleChange}
            />
          )}
          {!isProcessed && (
            <button
              onClick={processGitUrl}
              className="w-full rounded bg-indigo-50 py-2 px-3 text-md font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100"
            >
              {loading ? <BeatLoader color={"#fff"} /> : "Process Git URL"}
            </button>
          )}
          {isProcessed && (
            <button
              onClick={resetUrl}
              className="mt-4 w-full rounded bg-red-50 py-2 px-3 text-md font-semibold text-red-600 shadow-sm hover:bg-red-100"
            >
              Reset URL
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
