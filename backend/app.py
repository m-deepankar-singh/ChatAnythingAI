from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
from langchain.embeddings import OpenAIEmbeddings
from langchain.document_loaders import PyPDFLoader
from langchain.document_loaders.csv_loader import CSVLoader
from langchain.document_loaders import WebBaseLoader
from langchain.document_loaders import GitLoader
from langchain.document_loaders import Docx2txtLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.document_loaders import YoutubeLoader
import glob
import pinecone
from langchain.vectorstores import Pinecone
from langchain.document_loaders import DataFrameLoader
from dotenv import load_dotenv
from langchain.document_loaders import TextLoader
from langchain.document_loaders import AzureBlobStorageContainerLoader
from azure.storage.blob import BlobServiceClient, BlobClient, ContainerClient
from azure.core.exceptions import AzureError
load_dotenv()

app = Flask(__name__)
CORS(app)

uploaded_files = []

connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
container=os.getenv("CONTAINER_NAME")

index_name="pdf"

pinecone.init(
    api_key=os.getenv("PINECONE_API_KEY"),
    environment=os.getenv("PINECONE_ENV")
)



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

# @app.route("/uploadFile", methods=["POST"])
# def upload_file():
#     if 'files[]' not in request.files:
#         return "Please send a POST request with files", 400

#     blob_service_client = BlobServiceClient.from_connection_string(connection_string)
#     container_client = blob_service_client.get_container_client(container)
    
#     filenames = []
#     try:
#         uploaded_files = request.files.getlist("files[]")
#         for file in uploaded_files:
#             filename = secure_filename(file.filename)
#             blob_client = container_client.get_blob_client(filename)
#             blob_client.upload_blob(file, overwrite=True)
#             filenames.append(filename)

#     except AzureError as e:
#         return jsonify({"error": "Azure Blob Storage Error: {}".format(e)}), 500

#     except Exception as e:
#         return jsonify({"error": "An error occurred: {}".format(e)}), 500

#     return jsonify(filenames), 200





@app.route('/process', methods=['GET'])
def process_files():
    all_files = glob.glob("documents/*")

    if not all_files:
        return jsonify({"error": "No files found in the documents directory"}), 400

    all_pages = []
    for file_path in all_files:
        file_extension = os.path.splitext(file_path)[-1].lower()

        if file_extension == '.pdf':
            loader = PyPDFLoader(file_path)
            pages = loader.load_and_split()
            all_pages.extend(pages)

        elif file_extension == '.csv':
            try:
                loader = CSVLoader(file_path=file_path, encoding="utf-8")
                all_pages = loader.load_and_split()
            except:
                loader = CSVLoader(file_path=file_path, encoding="cp1252")
                all_pages = loader.load_and_split()           

        elif file_extension == '.docx':
            loader = Docx2txtLoader(file_path)
            pages=loader.load_and_split()
            all_pages.extend(pages)

        elif file_extension == '.txt':
            loader= TextLoader(file_path=file_path)
            pages=loader.load_and_split()
            all_pages.extend(pages)


    embeddings = OpenAIEmbeddings()
    if index_name not in pinecone.list_indexes(): 
    # we create a new index
     pinecone.create_index(
        name=index_name,
        metric='cosine',
        dimension=1536  # 1536 dim of text-embedding-ada-002
    ) 
    Pinecone.from_documents(all_pages, embedding=embeddings,index_name=index_name)

    for file_path in all_files:
        os.remove(file_path)

    return jsonify({'message': 'files processed successfully'}), 200

@app.route('/url', methods=['POST'])
def process_urls():
    data = request.get_json()
    urls = data.get('urls', None)
    
    if not urls:
        return jsonify({"error": "No URLs provided"}), 400

    all_pages = []

    # Load pages from URLs
    loader = WebBaseLoader(web_path=urls)
    loader.requests_kwargs = {'verify':False}
    url_pages = loader.load_and_split()
    all_pages.extend(url_pages)

    embeddings = OpenAIEmbeddings()
    if index_name not in pinecone.list_indexes(): 
        # we create a new index
        pinecone.create_index(
            name=index_name,
            metric='cosine',
            dimension=1536  # 1536 dim of text-embedding-ada-002
        ) 
    Pinecone.from_documents(all_pages, embedding=embeddings, index_name=index_name)

    return jsonify({'message': 'URLs processed successfully'}), 200

@app.route('/git', methods=['POST'])
def process_git():
    data = request.get_json()
    git_url = data.get('git_url', None)
    
    if not git_url:
        return jsonify({"error": "No Git URL provided"}), 400

    all_pages = []

    # Check if "repo" directory exists, and create it if not
    repo_path = "repo"
    if not os.path.exists(repo_path):
        os.makedirs(repo_path)

    # Load pages from URLs
    loader = GitLoader(clone_url=git_url, repo_path=repo_path, branch="main")
    text_splitter = RecursiveCharacterTextSplitter()
    url_pages = loader.load_and_split(text_splitter=text_splitter)
    all_pages.extend(url_pages)

    embeddings = OpenAIEmbeddings()
    if index_name not in pinecone.list_indexes(): 
        # we create a new index
        pinecone.create_index(
            name=index_name,
            metric='cosine',
            dimension=1536  # 1536 dim of text-embedding-ada-002
        ) 
    Pinecone.from_documents(all_pages, embedding=embeddings, index_name=index_name)

# Empty the repo directory
    for root, dirs, files in os.walk(repo_path, topdown=False):
        for name in files:
            os.chmod(os.path.join(root, name), 0o777)
            os.unlink(os.path.join(root, name))
        for name in dirs:
            os.chmod(os.path.join(root, name), 0o777)
            os.rmdir(os.path.join(root, name))

    return jsonify({'message': 'Git URL processed successfully'}), 200

@app.route('/youtube', methods=['POST'])
def process_youtube():
    data = request.get_json()
    urls = data.get('urls', None)
    
    if not urls:
        return jsonify({"error": "No URLs provided"}), 400

    all_pages = []

    # Load pages from URLs
    loader = YoutubeLoader.from_youtube_url(
    youtube_url=urls, add_video_info=True
    )
    url_pages = loader.load_and_split()
    all_pages.extend(url_pages)

    embeddings = OpenAIEmbeddings()
    if index_name not in pinecone.list_indexes(): 
        # we create a new index
        pinecone.create_index(
            name=index_name,
            metric='cosine',
            dimension=1536  # 1536 dim of text-embedding-ada-002
        ) 
    Pinecone.from_documents(all_pages, embedding=embeddings, index_name=index_name)

    return jsonify({'message': 'Transcript processed successfully'}), 200



@app.route('/delete', methods=['DELETE'])
def delete_index():
    index = pinecone.Index(index_name)
    index.delete(delete_all='true')
    return jsonify({'message': 'Pinecone index deleted successfully'}), 200



if __name__ == '__main__':
    app.run(debug=True)
