import React, { useState } from "react";
import axios from "axios";
import BeatLoader from "react-spinners/BeatLoader";

export default function URLProcessor() {
  const [urlEntries, setUrlEntries] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [isUrlsProcessed, setIsUrlsProcessed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUrlChange =
    (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const newUrlEntries = [...urlEntries];
      newUrlEntries[index] = e.target.value;
      setUrlEntries(newUrlEntries);
    };

  const addUrlField = () => {
    setUrlEntries((prevUrls) => [...prevUrls, ""]);
  };

  const processUrls = async () => {
    setLoading(true);
    setIsProcessing(true);
    try {
      const response = await axios.post("https://chatany.onrender.com/url", {
        urls: urlEntries,
      });
      console.log(response.data);
      setIsUrlsProcessed(true);
    } catch (error) {
      console.log(error);
    }
    setLoading(false);
    setIsProcessing(false);
  };

  const resetUrls = () => {
    setUrlEntries([]);
    setIsUrlsProcessed(false);
    setIsProcessing(false);
  };

  return (
    <div className="font-default flex items-center justify-center">
      <div className="flex min-h-fit flex-col items-center justify-center text-white">
        <div className="space-y-4 p-4">
          {urlEntries.map((url, index) => (
            <div className="flex items-center">
              <input
                className="flex-grow rounded bg-white py-2 px-3 text-md font-semibold text-black shadow-sm"
                type="text"
                placeholder="Enter URL here..."
                value={url}
                onChange={handleUrlChange(index)}
              />
              {index === urlEntries.length - 1 && (
                <button
                  onClick={addUrlField}
                  className="ml-2 bg-green-400 p-2 rounded text-white"
                >
                  +
                </button>
              )}
            </div>
          ))}
          {urlEntries.length > 0 && !isUrlsProcessed && (
            <>
              <button
                onClick={processUrls}
                className="w-full rounded bg-indigo-50 py-2 px-3 text-md font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100"
              >
                {loading ? <BeatLoader color={"#fff"} /> : "Process URLs"}
              </button>
              <button
                onClick={resetUrls}
                className="mt-4 w-full rounded bg-red-50 py-2 px-3 text-md font-semibold text-red-600 shadow-sm hover:bg-red-100"
              >
                Reset URLs
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
