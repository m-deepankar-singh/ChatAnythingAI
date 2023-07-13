import os
import shutil
import tempfile
import glob
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import pinecone
from multiprocessing import Pool
from langchain.embeddings import OpenAIEmbeddings
from langchain.document_loaders import (
    PyPDFLoader,
    CSVLoader,
    WebBaseLoader,
    GitLoader,
    Docx2txtLoader,
    TextLoader,
    YoutubeLoader,
)
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.vectorstores import Pinecone
from langchain.vectorstores import SupabaseVectorStore

load_dotenv()

app = Flask(__name__)
CORS(app)

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENV = os.getenv("PINECONE_ENV")
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
SUPABASE_BUCKET = "pdf"
index_name="pdf"

def upload_files_to_supabase(uploaded_files):
    filenames = []
    for file in uploaded_files:
        filename = secure_filename(file.filename)
        temp_file_path = os.path.join(tempfile.gettempdir(), filename)
        file.save(temp_file_path)
        with open(temp_file_path, 'rb') as f:
            res = supabase.storage.from_(SUPABASE_BUCKET).upload(filename, f)
            if res.status_code != 200:
                print(f"Error uploading {filename}: {res.body}")
            else:
                filenames.append(filename)
        os.remove(temp_file_path)
        
    return filenames

def process_file(file_path):
    file_extension = os.path.splitext(file_path)[-1].lower()
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    if file_extension == '.pdf':
        loader = PyPDFLoader(file_path)
        pages = loader.load_and_split(text_splitter=text_splitter)
    elif file_extension == '.csv':
        try:
            loader = CSVLoader(file_path=file_path, encoding="utf-8")
            pages = loader.load_and_split()
        except:
            loader = CSVLoader(file_path=file_path, encoding="cp1252")
            pages = loader.load_and_split()
    elif file_extension == '.docx':
        loader = Docx2txtLoader(file_path)
        pages = loader.load_and_split()
    elif file_extension == '.txt':
        loader = TextLoader(file_path=file_path)
        pages = loader.load_and_split()
    else:
        pages = []
    return pages


def process_files_from_supabase():
    # Create a temporary directory
    temp_dir = tempfile.mkdtemp()

    # Download files from Supabase Storage to the temp directory
    res = supabase.storage.from_(SUPABASE_BUCKET).list()
    for file_metadata in res:
        filename = file_metadata['name']
        download_file_path = os.path.join(temp_dir, filename)
        with open(download_file_path, 'wb') as f:
            res = supabase.storage.from_(SUPABASE_BUCKET).download(filename)
            f.write(res)
    
    all_files = glob.glob(f"{temp_dir}/*")
    if not all_files:
        return None, {"error": "No files found in the documents directory"}, 400
    
    all_pages = []
    for file_path in all_files:
        pages = process_file(file_path)
        all_pages.extend(pages)

    embeddings = OpenAIEmbeddings()
    SupabaseVectorStore.from_documents(all_pages, embedding=embeddings, client=supabase)

    # Remove the temporary directory
    shutil.rmtree(temp_dir)    
    
    return {'message': 'files processed successfully'}, 200

@app.route("/uploadFile", methods=["POST"])
def upload_file():
    if 'files[]' not in request.files:
        return "Please send a POST request with files", 400

    try:
        uploaded_files = request.files.getlist("files[]")
        filenames = upload_files_to_supabase(uploaded_files)
    except Exception as e:
        return jsonify({"error": "An error occurred: {}".format(e)}), 500

    return jsonify(filenames), 200

@app.route('/process', methods=['GET'])
def process_files():
    return process_files_from_supabase()



def process_url(url):
    loader = WebBaseLoader(web_path=url)
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    url_pages = loader.load_and_split(text_splitter=text_splitter)
    return url_pages

@app.route('/url', methods=['POST'])
def process_urls():
    data = request.get_json()
    urls = data.get('urls', None)
    
    if not urls:
        return jsonify({"error": "No URLs provided"}), 400

    all_pages = []
    with Pool() as pool:
        url_pages = pool.map(process_url, urls)
    for pages in url_pages:
        all_pages.extend(pages)

    embeddings = OpenAIEmbeddings()
    SupabaseVectorStore.from_documents(all_pages, embedding=embeddings, client=supabase)

    return jsonify({'message': 'URLs processed successfully'}), 200

@app.route('/git', methods=['POST'])
def process_git():
    data = request.get_json()
    git_url = data.get('git_url', None)
    
    if not git_url:
        return jsonify({"error": "No Git URL provided"}), 400

    all_pages = []

    # Create a temporary directory
    with tempfile.TemporaryDirectory() as repo_path:
        # Load pages from URLs
        loader = GitLoader(clone_url=git_url, repo_path=repo_path, branch="main")
        text_splitter = RecursiveCharacterTextSplitter()
        url_pages = loader.load_and_split(text_splitter=text_splitter)
        all_pages.extend(url_pages)

        # # Get Blob service client
        # blob_service_client = BlobServiceClient.from_connection_string(connection_string)

        # # Name of the Blob container in your storage
        # container_name = container

        # # Upload repo directory to Blob storage
        # for root, dirs, files in os.walk(repo_path, topdown=False):
        #     for name in files:
        #         file_path = os.path.join(root, name)
        #         blob_client = blob_service_client.get_blob_client(container_name, file_path)
        #         with open(file_path, "rb") as data:
        #             blob_client.upload_blob(data)

        embeddings = OpenAIEmbeddings()
    SupabaseVectorStore.from_documents(all_pages, embedding=embeddings, client=supabase)

    # No need to manually delete files in the temporary directory, as it gets removed automatically

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
    SupabaseVectorStore.from_documents(all_pages, embedding=embeddings, client=supabase)

    return jsonify({'message': 'Transcript processed successfully'}), 200



@app.route('/delete', methods=['DELETE'])
def delete_index():
    # Delete files from Supabase Storage
    res = supabase.storage.from_(SUPABASE_BUCKET).list()
    for file_metadata in res:
        filename = file_metadata['name']
        res = supabase.storage.from_(SUPABASE_BUCKET).remove(filename)
    return jsonify({'message': 'Pinecone and files deleted successfully'}), 200



if __name__ == '__main__':
    app.run(debug=True)
