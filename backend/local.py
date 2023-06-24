from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import FAISS
from langchain.chat_models import ChatOpenAI
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationalRetrievalChain
from langchain.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
import glob
from langchain.embeddings import LlamaCppEmbeddings
from langchain.llms import LlamaCpp
from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler

app = Flask(__name__)
CORS(app)

uploaded_files = []

# Store conversation state here
conversation_state = {
    "conversation": None,
    "chat_history": None
}

callback_manager = CallbackManager([StreamingStdOutCallbackHandler()])


@app.route("/uploadFile", methods=["POST"])
def upload_file():
    if 'files[]' not in request.files:
        return "Please send a POST request with files", 400

    filenames = []
    try:
        uploaded_files = request.files.getlist("files[]")
        for file in uploaded_files:
            filename = secure_filename(file.filename)
            
            # Ensure the 'documents' directory exists
            if not os.path.exists('documents'):
                os.makedirs('documents')

            filepath = os.path.join('documents', filename)
            file.save(filepath)
            filenames.append(filename)

    except Exception as e:
        # cleanup temp files
        for file in filenames:
            filepath = os.path.join('documents', file)
            if os.path.exists(filepath):
                os.remove(filepath)
        return jsonify({"error": str(e)}), 500

    return jsonify(filenames), 200

@app.route('/process', methods=['GET'])
def process_files():
    all_files = glob.glob("documents/*.pdf")

    if not all_files:
        return jsonify({"error": "No files found in the documents directory"}), 400

    all_pages = []
    for file_path in all_files:
        loader = PyPDFLoader(file_path)
        text_splitter = RecursiveCharacterTextSplitter(
    # Set a really small chunk size, just to show.
    chunk_size = 400,
    chunk_overlap  = 20,
    length_function = len,
    add_start_index = True,
)
        pages = loader.load_and_split(text_splitter=text_splitter)
        all_pages.extend(pages)


    embeddings = LlamaCppEmbeddings(model_path="./models/Wizard-Vicuna-7B-Uncensored.ggmlv3.q2_K.bin")
    vectorstore = FAISS.from_documents(all_pages, embedding=embeddings)
    conversation_state["conversation"] = get_conversation_chain(vectorstore)

    return jsonify({'message': 'files processed successfully'}), 200

@app.route('/chat', methods=['POST'])
def chat():
    try:
        user_question = request.json.get('question')
        if conversation_state["conversation"]:
            response = conversation_state["conversation"]({'question': user_question})
            conversation_state["chat_history"] = response['chat_history']

            # Prepare chat history for response
            chat_history = []
            for i, message in enumerate(conversation_state["chat_history"]):
                sender = "User: " if i % 2 == 0 else "Bot: "
                chat_history.append(sender + message.content)

            return jsonify({'chat_history': chat_history}), 200
        else:
            return jsonify({'message': 'No conversation initialized'}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500



def get_conversation_chain(vectorstore):
    llm = LlamaCpp(model_path="./models/Wizard-Vicuna-7B-Uncensored.ggmlv3.q2_K.bin", callback_manager=callback_manager, verbose=True)    
    memory = ConversationBufferMemory(
        memory_key='chat_history', return_messages=True)
    conversation_chain = ConversationalRetrievalChain.from_llm(
        llm=llm,
        retriever=vectorstore.as_retriever(),
        memory=memory,
        condense_question_llm=ChatOpenAI(temperature=0,model_name="gpt-3.5-turbo"),
        verbose=True,
    )
    return conversation_chain


@app.route('/delete', methods=['DELETE'])
def delete_collection():
    if conversation_state["conversation"]:
        vectorstore = conversation_state["conversation"].retriever.vectorstore
        vectorstore.delete_collection()
        vectorstore.persist()
        return jsonify({'message': 'Collection deleted successfully'}), 200
    else:
        return jsonify({'message': 'No conversation initialized'}), 400




if __name__ == '__main__':
    app.run(debug=True)
