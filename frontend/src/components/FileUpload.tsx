import React, { ChangeEvent, FC, useState } from "react";
import axios from "axios";
import BeatLoader from "react-spinners/BeatLoader";

export default function FileUpload() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFilesUploaded, setIsFilesUploaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(file => {
        const fileExtension = file.name.split(".").pop()?.toLowerCase();
        return fileExtension === "pdf" || fileExtension === "csv" || fileExtension === "docx" || fileExtension === "txt";
      });
      setSelectedFiles((prevFiles) => [...prevFiles, ...files]);
    }
  };
    const uploadFiles = async () => {
    setLoading(true);
    const data = new FormData();
    selectedFiles.forEach((file) => {
      data.append("files[]", file);
    });

    try {
      const response = await axios.post(
        "https://chatany.onrender.com/uploadFile",
        data
      );
      console.log(response.data);
      setIsFilesUploaded(true);
    } catch (error) {
      console.log(error);
    }
    setLoading(false);
  };

  const processFiles = async () => {
    setLoading(true);
    setIsProcessing(true);
    try {
      const response = await axios.get("http://localhost:5000/process");
      console.log(response.data);
    } catch (error) {
      console.log(error);
    }
    setLoading(false);
    setIsProcessing(false);
  };

  const resetFiles = () => {
    setSelectedFiles([]);
    setIsFilesUploaded(false);
    setIsProcessing(false);
  };

  return (
    <div className="font-default  flex items-center justify-center">
      <div className="flex min-h-fit flex-col items-center justify-center text-white">
        <div className="space-y-4 p-4">
          {!isFilesUploaded && (
            <input
              className="hidden"
              type="file"
              multiple
              id="fileInput"
              onChange={handleFileChange}
              accept=".pdf,.csv,.docx,.txt"
            />
          )}
          {!isFilesUploaded && (
            <label
              htmlFor="fileInput"
              className="cursor-pointer w-full rounded bg-indigo-50 py-2 px-3 text-md font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100"
            >
              Choose files
            </label>
          )}
          {selectedFiles &&
            selectedFiles.map((file, index) => (
              <p key={index} className="text-sm">
                {file.name}
              </p>
            ))}
          {selectedFiles.length > 0 && !isFilesUploaded && (
            <>
              <button
                onClick={uploadFiles}
                className="w-full rounded bg-indigo-50 py-2 px-3 text-md font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100"
              >
                {loading ? <BeatLoader color={"#fff"} /> : "Upload"}
              </button>
              <button
                onClick={resetFiles}
                className="mt-4 w-full rounded bg-red-50 py-2 px-3 text-md font-semibold text-red-600 shadow-sm hover:bg-red-100"
              >
                Reset Files
              </button>
            </>
          )}
          {isFilesUploaded && (
            <>
              <button
                onClick={processFiles}
                className="mt-4 w-full rounded bg-indigo-50 py-2 px-3 text-md font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100"
              >
                {loading && isFilesUploaded ? (
                  <BeatLoader color={"#fff"} />
                ) : (
                  "Process Files"
                )}
              </button>
              <button
                onClick={resetFiles}
                className="mt-4 w-full rounded bg-red-50 py-2 px-3 text-md font-semibold text-red-600 shadow-sm hover:bg-red-100"
              >
                Reset Files
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
