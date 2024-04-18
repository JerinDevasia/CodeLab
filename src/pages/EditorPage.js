import React, { useState, useRef, useEffect } from "react";
import { VscTriangleLeft } from "react-icons/vsc";
import { IoMdShare } from "react-icons/io";
import { FaClipboard } from "react-icons/fa";
import { IoExitSharp } from "react-icons/io5";
import { FaDownload } from "react-icons/fa6";
import ACTIONS from "../Actions";
import Client from "../components/Client";
import Editor from "../components/Editor";
import { initSocket } from "../socket";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { toast } from "react-hot-toast";
import axios from "axios";
import { saveAs } from "file-saver";


const EditorPage = () => {
  const socketRef = useRef(null);
  const codeRef = useRef(null);
  const location = useLocation();
  const reactNavigator = useNavigate();
  const { roomId } = useParams();
  const [clients, setClients] = useState([]);



//  Content remains constant if socket is disconnected

useEffect(() => {
  // Function to save code to local storage
  const saveCodeToLocalStorage = () => {
    localStorage.setItem(`code_${roomId}`, codeRef.current);
  };

  // Function to retrieve code from local storage
  const loadCodeFromLocalStorage = () => {
    const savedCode = localStorage.getItem(`code_${roomId}`);
    if (savedCode) {
      codeRef.current = savedCode;
    }
  };

  // Load code from local storage when component mounts
  loadCodeFromLocalStorage();

  // Save code to local storage when component unmounts
  return () => {
    saveCodeToLocalStorage();
  };
}, [roomId]);

  
  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();

      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));

      function handleErrors(e) {
        console.log("socket error", e);
        toast.error("Socket connection failed, try again later.");
        reactNavigator("/");
      }

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: location.state?.username,
      });

      //Listening for joined event
      socketRef.current.on(
        ACTIONS.JOINED,
        ({ clients, username, socketId }) => {
          if (username !== location.state?.username) {
            toast.success(`${username} joined the room.`);
            console.log(`${username} joined`);
          }
          setClients(clients);
          socketRef.current.emit(ACTIONS.SYNC_CODE, {
            code: codeRef.current,
            socketId,
          });
        }
      );

      //Listeing for disconnected
      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room.`);
        setClients((prev) => {
          return prev.filter((client) => client.socketId !== socketId);
        });
      });

      //Listening for message
      socketRef.current.on(ACTIONS.SEND_MESSAGE, ({ message }) => {
        const chatWindow = document.getElementById("chatWindow");
        var currText = chatWindow.value;
        currText += message;
        chatWindow.value = currText;
        chatWindow.scrollTop = chatWindow.scrollHeight;
      });

    };
    init();
    return () => {
      socketRef.current.off(ACTIONS.JOINED);
      socketRef.current.off(ACTIONS.DISCONNECTED);
      socketRef.current.off(ACTIONS.SEND_MESSAGE);
      socketRef.current.disconnect();
    };
  }, []);

 


  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room ID has been copied to your clipboard");
    } catch (err) {
      toast.error("Could not copy the room id");
      console.error(err);
    }
  }

  const shareURL = async () => {
    const url = window.location.href
    try {
        await navigator.share({ url })
    } catch (error) {
        toast.error("Unable to share URL")
        console.log(error)
    }
}

  function leaveRoom() {
    reactNavigator("/");
  }

  if (!location.state) {
    return <Navigate to="/" />;
  }


// Code download feature
const handleDownload = () => {
  const code = codeRef.current; // Assuming codeRef is a ref to the code content
  const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, 'code.txt');
};

  const inputClicked = () => {
    const inputArea = document.getElementById("input");
    inputArea.placeholder = "Enter your input here";
    inputArea.value = "";
    inputArea.disabled = false;
    const inputLabel = document.getElementById("inputLabel");
    const outputLabel = document.getElementById("outputLabel");
    inputLabel.classList.remove("notClickedLabel");
    inputLabel.classList.add("clickedLabel");
    outputLabel.classList.remove("clickedLabel");
    outputLabel.classList.add("notClickedLabel");
  };

  const outputClicked = () => {
    const inputArea = document.getElementById("input");
    inputArea.placeholder =
      "You output will apear here, Click 'Run code' to see it";
    inputArea.value = "";
    inputArea.disabled = true;
    const inputLabel = document.getElementById("inputLabel");
    const outputLabel = document.getElementById("outputLabel");
    inputLabel.classList.remove("clickedLabel");
    inputLabel.classList.add("notClickedLabel");
    outputLabel.classList.remove("notClickedLabel");
    outputLabel.classList.add("clickedLabel");
  };

  const runCode = () => {
    const lang = document.getElementById("languageOptions").value;
    const input = document.getElementById("input").value;
    const code = codeRef.current;

    toast.loading("Running Code....");

    const encodedParams = new URLSearchParams();
    encodedParams.append("LanguageChoice", lang);
    encodedParams.append("Program", code);
    encodedParams.append("Input", input);

    const options = {
      method: "POST",
      url: "https://code-compiler.p.rapidapi.com/v2",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "X-RapidAPI-Key": '049808f3e4msh0413b01345a01b4p17cacfjsnaca2298d2a92',
        "X-RapidAPI-Host": "code-compiler.p.rapidapi.com",
      },
      data: encodedParams,
    };

    console.log(options);

    axios
      .request(options)
      .then(function (response) {
        let message = response.data.Result;
        if (message === null) {
          message = response.data.Errors;
        }
        outputClicked();
        document.getElementById("input").value = message;
        toast.dismiss();
        toast.success("Code compilation complete");
      })
      .catch(function (error) {
        toast.dismiss();
        toast.error("Code compilation unsuccessful");
        document.getElementById("input").value =
          "Something went wrong, Please check your code and input.";
      });
  };

  const sendMessage = () => {
    if (document.getElementById("inputBox").value === "") return;
    var message = `> ${location.state.username}:\n${
      document.getElementById("inputBox").value
    }\n`;
    const chatWindow = document.getElementById("chatWindow");
    var currText = chatWindow.value;
    currText += message;
    chatWindow.value = currText;
    chatWindow.scrollTop = chatWindow.scrollHeight;
    document.getElementById("inputBox").value = "";
    socketRef.current.emit(ACTIONS.SEND_MESSAGE, { roomId, message });
  };

  const handleInputEnter = (key) => {
    if (key.code === "Enter") {
      sendMessage();
    }
  };

  return (
    <div className="mainWrap">
      <div className="asideWrap">
        <div className="asideInner">
          <div className="logo">
            <img className="logoImage" src="/code-sync.png" alt="logo" />
          </div>
          <h3>Connected</h3>
          <div className="clientsList">
            {clients.map((client) => (
              <Client key={client.socketId} username={client.username} />
            ))}
          </div>
        </div>

{/* First tab features including downloading feature */}


       <div className="buttonss">
        <button className="btn runBtn" onClick={handleDownload} title="Download">
          <FaDownload className="ico"/>
        </button>

        {/* <button className="btn copyBtn" onClick={shareURL} title="Share Link"> 
          <IoMdShare className="ic"/>
        </button>

        <button className="btn " onClick={copyRoomId} title="Copy Room ID">
          <FaClipboard className="ic"/>
        </button>

        <button className="btn leaveBtn" onClick={leaveRoom} title="Leave Room">
          <IoExitSharp className="ic"/>
        </button> */}

      </div> 


        <label>
          <select id="languageOptions" className="seLang" defaultValue="17" title="Select Language">
            <option value="1">C#</option>
            <option value="4">Java</option>
            <option value="5">Python</option>
            <option value="6">C (gcc)</option>
            <option value="7">C++ (gcc)</option>
            <option value="8">PHP</option>
            <option value="11">Haskell</option>
            <option value="12">Ruby</option>
            <option value="13">Perl</option>
            <option value="17">Javascript</option>
            <option value="20">Golang</option>
            <option value="21">Scala</option>
            <option value="37">Swift</option>
            <option value="38">Bash</option>
            <option value="43">Kotlin</option>
            <option value="60">TypeScript</option>
          </select>
        </label>
      <div className="buttonss">
        <button className="btn runBtn" onClick={runCode} title="Run Code">
          {/* Run Code */}
          <VscTriangleLeft className="ico"/>
        </button>

        <button className="btn copyBtn" onClick={shareURL} title="Share Link">
          {/* Share */}
          <IoMdShare className="ic"/>
         </button>

         <button className="btn " onClick={copyRoomId} title="Copy Room ID">
          {/* Copy ROOM ID */}
          <FaClipboard className="ic"/>

        </button>

        <button className="btn leaveBtn" onClick={leaveRoom} title="Leave Room">
          {/* Leave */}
          <IoExitSharp className="ic"/>

        </button>

      </div> 

      {/* <div className="buttonsss">

        <button className="btnn copyBtn" onClick={copyRoomId} title="Copy Room ID">
          Copy ROOM ID
        </button>

        <button className="btnn leaveBtn" onClick={leaveRoom} title="Leave Room">
          Leave
        </button>
      </div> */}
      </div>

      <div className="editorWrap">
        <Editor
          socketRef={socketRef}
          roomId={roomId}
          // value = {content}
          // onChange={handleChange}
          onCodeChange={(code) => {
            codeRef.current = code;
          }}
        />
        <div className="IO-container">
          <label
            id="inputLabel"
            className="clickedLabel"
            onClick={inputClicked}
          >
            Input
          </label>
          <label
            id="outputLabel"
            className="notClickedLabel"
            onClick={outputClicked}
          >
            Output
          </label>
        </div>
        <textarea
          id="input"
          className="inputArea textarea-style"
          placeholder="Enter your input here"
        ></textarea>
      </div>

      <div className="chatWrap">
        <textarea
          id="chatWindow"
          className="chatArea textarea-style"
          placeholder="Chat messages will appear here"
          disabled
        ></textarea>
        <div className="sendChatWrap">
          <input
            id="inputBox"
            type="text"
            placeholder="Type your message here"
            className="inputField"
            onKeyUp={handleInputEnter}
          ></input>
          <button className="btn sendBtn cbt" onClick={sendMessage}>
            Send
          </button>
        </div>
      </div> 
    </div>
  );
};

export default EditorPage;
