"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { API_URL } from "../../lib/config";
import ThemeToggle from "../components/ThemeToggle";

export default function ChatPage() {
  const router = useRouter();
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [viewingImage, setViewingImage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [receiverId, setReceiverId] = useState("");
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Loading states
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const selectedUserRef = useRef(null);

  const [isTyping, setIsTyping] = useState(false);

  // Store unread message count for each user
  const [unreadCounts, setUnreadCounts] = useState({});

  // Store last message for each conversation
  const [lastMessages, setLastMessages] = useState({});

  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);

  // --------------------------------
  // AUTH ERROR HANDLER
  // --------------------------------

  const handleAuthFailure = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("receiverId");
    router.push("/login");
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error.message);
    } finally {
      socket?.disconnect();
      localStorage.removeItem("user");
      localStorage.removeItem("receiverId");
      setUser(null);
      setSelectedUser(null);
      setMessages([]);
      setUsers([]);
      setUnreadCounts({});
      setLastMessages({});
      router.push("/login");
    }
  };

  // --------------------------------
  // GET LOGGED-IN USER
  // --------------------------------

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedUser = localStorage.getItem("user");

      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  // --------------------------------
  // KEEP SELECTED USER REF UPDATED
  // --------------------------------

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // --------------------------------
  // LOAD MESSAGE HISTORY
  // --------------------------------

  const loadMessages = async (userId) => {
    setLoadingMessages(true);

    try {
      const response = await fetch(
        `${API_URL}/api/messages/${userId}`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      if (response.status === 401) {
        handleAuthFailure();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load messages");
      }

      setMessages(data.messages);

      // --------------------------------
      // UPDATE LAST MESSAGE
      // --------------------------------

      if (data.messages.length > 0) {
        const lastMessage = data.messages[data.messages.length - 1];

        setLastMessages((previousMessages) => ({
          ...previousMessages,
          [userId]: lastMessage,
        }));
      }
    } catch (error) {
      setErrorMessage("Unable to load this conversation. Please try again.");
      console.error("Load messages error:", error.message);
    } finally {
      setLoadingMessages(false);
    }
  };

  // --------------------------------
  // ADD MESSAGE WITHOUT DUPLICATES
  // --------------------------------

  const addUniqueMessage = (newMessage) => {
    setMessages((previousMessages) => {
      const messageAlreadyExists = previousMessages.some(
        (msg) => msg._id === newMessage._id,
      );

      if (messageAlreadyExists) {
        return previousMessages;
      }

      return [...previousMessages, newMessage];
    });
  };

  const updateLastMessagePreview = (updatedMessage) => {
    const otherUserId =
      updatedMessage.sender?._id === user?.id
        ? updatedMessage.receiver?._id
        : updatedMessage.sender?._id;

    if (otherUserId) {
      setLastMessages((previousMessages) => ({
        ...previousMessages,
        [otherUserId]: updatedMessage,
      }));
    }
  };

  // --------------------------------
  // LOAD USERS
  // --------------------------------

  const loadUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users`, {
        credentials: "include",
      });

      if (response.status === 401) {
        handleAuthFailure();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load users");
      }

      setUsers(data.users);

      // --------------------------------
      // RESTORE UNREAD COUNTS
      // --------------------------------

      const counts = {};

      data.users.forEach((chatUser) => {
        if (chatUser.unreadCount > 0) {
          counts[chatUser._id] = chatUser.unreadCount;
        }
      });

      setUnreadCounts(counts);

      // --------------------------------
      // RESTORE LAST MESSAGE PREVIEWS
      // --------------------------------

      const previews = {};

      data.users.forEach((chatUser) => {
        if (chatUser.lastMessage) {
          previews[chatUser._id] = chatUser.lastMessage;
        }
      });

      setLastMessages(previews);
    } catch (error) {
      setErrorMessage("Unable to load chats. Please check the server connection.");
      console.error("Load users error:", error.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    const query = searchQuery.trim();

    if (!query) {
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      
      try {
        setSearchLoading(true);

        const response = await fetch(
          `${API_URL}/api/users/search?q=${encodeURIComponent(query)}`,
          {
            credentials: "include",
            signal: controller.signal,
          },
        );

        if (response.status === 401) {
          handleAuthFailure();
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Search failed");
        }

        setSearchResults(data.users || []);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Search users error:", error.message);
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
    // Search uses the initial auth failure handler, like the socket effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadUsers();
    }, 0);

    return () => window.clearTimeout(timeoutId);
    // loadUsers only reads browser storage and is intentionally run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------
  // SOCKET CONNECTION
  // --------------------------------

  useEffect(() => {
    const newSocket = io(API_URL, {
  withCredentials: true,
  transports: ["websocket", "polling"],
});

    // --------------------------------
    // SOCKET CONNECTED
    // --------------------------------

    newSocket.on("connect", () => {
      setConnectionStatus("connected");
      setErrorMessage("");
      console.log("Connected:", newSocket.id);
    });

    // --------------------------------
    // SOCKET CONNECTION ERROR
    // --------------------------------

    newSocket.on("connect_error", (err) => {
      console.error("Socket connect error:", err.message);
      setConnectionStatus("disconnected");
      setErrorMessage(
        `Server unavailable (${err.message}). Trying to reconnect...`,
      );

      if (
        err.message?.toLowerCase().includes("token") ||
        err.message?.toLowerCase().includes("auth")
      ) {
        handleAuthFailure();
      }
    });

    newSocket.io.on("reconnect_attempt", () => {
      setConnectionStatus("reconnecting");
    });

    newSocket.io.on("reconnect", () => {
      setConnectionStatus("connected");
      setErrorMessage("");
    });

    newSocket.io.on("reconnect_failed", () => {
      setConnectionStatus("disconnected");
      setErrorMessage("Unable to reconnect to the server.");
    });

    // --------------------------------
    // MESSAGE SENT BY CURRENT USER
    // --------------------------------

    newSocket.on("messageSent", (newMessage) => {
      console.log("Message sent:", newMessage);

      addUniqueMessage(newMessage);

      const receiverUserId =
        newMessage.receiver?._id || newMessage.receiver;

      if (receiverUserId) {
        setLastMessages((previousMessages) => ({
          ...previousMessages,
          [receiverUserId]: newMessage,
        }));
      }
    });

    // --------------------------------
    // MESSAGE RECEIVED
    // --------------------------------

    newSocket.on("newMessage", (newMessage) => {
      console.log("New message:", newMessage);

      const senderUserId =
        newMessage.sender?._id || newMessage.sender;

      // --------------------------------
      // UPDATE LAST MESSAGE
      // --------------------------------

      if (senderUserId) {
        setLastMessages((previousMessages) => ({
          ...previousMessages,
          [senderUserId]: newMessage,
        }));
      }

      // --------------------------------
      // CHECK IF CHAT IS OPEN
      // --------------------------------

      if (senderUserId === selectedUserRef.current?._id) {
        // Message belongs to currently open chat

        addUniqueMessage(newMessage);

        newSocket.emit("markMessagesSeen", {
          senderId: senderUserId,
        });
      } else {
        // Message belongs to another chat

        setUnreadCounts((previousCounts) => ({
          ...previousCounts,
          [senderUserId]:
            (previousCounts[senderUserId] || 0) + 1,
        }));

        // Browser notification

        if (
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          new Notification(
            newMessage.sender?.username || "New message",
            {
              body:
                newMessage.messageType === "image"
                  ? "📷 Sent an image"
                  : newMessage.content,
            },
          );
        }
      }
    });

    // --------------------------------
    // MESSAGES SEEN
    // --------------------------------

    newSocket.on("messagesSeen", ({ receiverId }) => {
      setMessages((previousMessages) =>
        previousMessages.map((msg) => {
          if (msg.receiver?._id === receiverId) {
            return {
              ...msg,
              isSeen: true,
              seenAt: new Date(),
            };
          }

          return msg;
        }),
      );
    });

    // --------------------------------
    // USER TYPING
    // --------------------------------

    newSocket.on("userTyping", () => {
      setIsTyping(true);
    });

    // --------------------------------
    // USER STOPPED TYPING
    // --------------------------------

    newSocket.on("userStoppedTyping", () => {
      setIsTyping(false);
    });

    // --------------------------------
    // MESSAGE DELIVERED
    // --------------------------------

    newSocket.on("messageDelivered", ({ messageId }) => {
      setMessages((previousMessages) =>
        previousMessages.map((msg) =>
          msg._id === messageId
            ? {
                ...msg,
                isDelivered: true,
              }
            : msg,
        ),
      );
    });

    newSocket.on("messageUpdated", (updatedMessage) => {
      setMessages((previousMessages) =>
        previousMessages.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg,
        ),
      );
      updateLastMessagePreview(updatedMessage);
    });

    newSocket.on("messageDeleted", (deletedMessage) => {
      setMessages((previousMessages) =>
        previousMessages.map((msg) =>
          msg._id === deletedMessage._id ? deletedMessage : msg,
        ),
      );
      updateLastMessagePreview(deletedMessage);
    });

    // --------------------------------
    // USER ONLINE
    // --------------------------------

    newSocket.on("userOnline", ({ userId }) => {
      setUsers((previousUsers) =>
        previousUsers.map((chatUser) =>
          chatUser._id === userId
            ? {
                ...chatUser,
                isOnline: true,
                lastSeen: null,
              }
            : chatUser,
        ),
      );

      setSelectedUser((previousUser) => {
        if (previousUser?._id !== userId) {
          return previousUser;
        }

        return {
          ...previousUser,
          isOnline: true,
          lastSeen: null,
        };
      });
    });

    // --------------------------------
    // USER OFFLINE
    // --------------------------------

    newSocket.on("userOffline", ({ userId }) => {
      setUsers((previousUsers) =>
        previousUsers.map((chatUser) =>
          chatUser._id === userId
            ? {
                ...chatUser,
                isOnline: false,
                lastSeen: new Date(),
              }
            : chatUser,
        ),
      );

      setSelectedUser((previousUser) => {
        if (previousUser?._id !== userId) {
          return previousUser;
        }

        return {
          ...previousUser,
          isOnline: false,
          lastSeen: new Date(),
        };
      });
    });

    // --------------------------------
    // SOCKET DISCONNECTED
    // --------------------------------

    newSocket.on("disconnect", () => {
      setConnectionStatus("disconnected");
      setErrorMessage("Socket disconnected. Trying to reconnect...");
      console.log("Socket disconnected");
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
    // Socket listeners intentionally use the initial authentication token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------
  // AUTO SCROLL
  // --------------------------------

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // --------------------------------
  // MARK MESSAGES AS SEEN
  // --------------------------------

  useEffect(() => {
    if (!socket || !selectedUser) {
      return;
    }

    socket.emit("markMessagesSeen", {
      senderId: selectedUser._id,
    });

  }, [socket, selectedUser]);

  // --------------------------------
  // NOTIFICATION PERMISSION
  // --------------------------------

  useEffect(() => {
    if ("Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  // --------------------------------
  // IMAGE SELECT
  // --------------------------------

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    // Only allow images

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    // Limit image size to 5MB

    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB.");
      return;
    }

    setSelectedImage(file);

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  };

  // --------------------------------
  // REMOVE SELECTED IMAGE
  // --------------------------------

  const removeSelectedImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedImage(null);
    setImagePreview("");
  };

  // --------------------------------
  // EMOJIS
  // --------------------------------

  const emojis = [
    "😀",
    "😃",
    "😄",
    "😁",
    "😆",
    "😅",
    "😂",
    "🤣",
    "😊",
    "😇",
    "🙂",
    "🙃",
    "😉",
    "😌",
    "😍",
    "🥰",
    "😘",
    "😗",
    "😙",
    "😚",
    "😋",
    "😛",
    "😝",
    "😜",
    "🤪",
    "🤨",
    "🧐",
    "🤓",
    "😎",
    "🤩",
    "🥳",
    "😏",
    "😢",
    "😭",
    "😡",
    "🤬",
    "👍",
    "👎",
    "👏",
    "🙏",
    "❤️",
    "🔥",
    "💯",
    "🎉",
    "😂",
    "💔",
    "❤️‍🔥",
  ];

  // --------------------------------
  // ADD EMOJI
  // --------------------------------

  const addEmoji = (emoji) => {
    setMessage((previousMessage) => previousMessage + emoji);
    setShowEmojiPicker(false);
  };

  const startEditingMessage = (messageToEdit) => {
    setEditingMessage(messageToEdit);
    setMessage(messageToEdit.content);
    setShowEmojiPicker(false);
  };

  const cancelEditingMessage = () => {
    setEditingMessage(null);
    setMessage("");
  };

  const deleteMessage = (messageId) => {
    if (!socket || !socket.connected) {
      setErrorMessage("You are not connected. Please try again.");
      return;
    }

    socket.emit("deleteMessage", { messageId }, (response) => {
      if (!response?.ok) {
        setErrorMessage(response?.message || "Message deletion failed.");
      }
    });
  };

  // --------------------------------
  // SEND MESSAGE
  // --------------------------------

  const sendMessage = async (e) => {
    e.preventDefault();

    if (!socket || !socket.connected || isSending) {
      setErrorMessage("You are not connected. Please wait and try again.");
      return;
    }

    if (editingMessage) {
      if (!message.trim()) {
        return;
      }

      socket.emit(
        "editMessage",
        {
          messageId: editingMessage._id,
          content: message,
        },
        (response) => {
          if (!response?.ok) {
            setErrorMessage(response?.message || "Message edit failed.");
            return;
          }

          cancelEditingMessage();
        },
      );
      return;
    }

    if (!receiverId) {
      return;
    }

    if (!selectedImage && !message.trim()) {
      return;
    }

    setIsSending(true);
    setErrorMessage("");

    // --------------------------------
    // IMAGE MESSAGE
    // --------------------------------

    if (selectedImage) {
      try {
        const formData = new FormData();

        formData.append("image", selectedImage);

        const response = await fetch(
          `${API_URL}/api/messages/upload`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          },
        );

        const data = await response.json();

        if (!response.ok) {
          setErrorMessage(data.message || "Image upload failed.");
          setIsSending(false);
          return;
        }

        socket.emit("sendMessage", {
          receiverId,
          content: data.imageUrl,
          messageType: "image",
        });

        removeSelectedImage();
        setIsSending(false);

        return;
      } catch (error) {
        console.error("Image upload error:", error);
        setErrorMessage("Image upload failed. Please try again.");
        setIsSending(false);
        return;
      }
    } else {
      socket.emit("sendMessage", {
        receiverId,
        content: message,
        messageType: "text",
      });

      setMessage("");
    }

    setIsSending(false);
  };

  // --------------------------------
  // TYPING
  // --------------------------------

  const handleTyping = (e) => {
    const value = e.target.value;

    setMessage(value);

    if (!socket || !selectedUser) {
      return;
    }

    socket.emit("typing", {
      receiverId: selectedUser._id,
    });

    clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stopTyping", {
        receiverId: selectedUser._id,
      });
    }, 1000);
  };

  // --------------------------------
  // SELECT USER
  // --------------------------------

  const selectUser = (chatUser) => {
    setSelectedUser(chatUser);

    setReceiverId(chatUser._id);

    localStorage.setItem("receiverId", chatUser._id);

    // --------------------------------
    // SHOW LOADING STATE
    // --------------------------------

    setLoadingMessages(true);

    // Clear current messages immediately
    setMessages([]);

    // Reset unread count
    setUnreadCounts((previousCounts) => ({
      ...previousCounts,
      [chatUser._id]: 0,
    }));

    // Load selected conversation
    loadMessages(chatUser._id);

    // Mark messages as seen
    if (socket) {
      socket.emit("markMessagesSeen", {
        senderId: chatUser._id,
      });
    }

    // Stop typing indicator
    setIsTyping(false);
    setEditingMessage(null);

    // Close emoji picker
    setShowEmojiPicker(false);
  };

  // --------------------------------
  // FORMAT LAST MESSAGE TIME
  // --------------------------------

  const formatMessageTime = (date) => {
    if (!date) {
      return "";
    }

    const messageDate = new Date(date);

    const now = new Date();

    const isToday =
      messageDate.toDateString() === now.toDateString();

    if (isToday) {
      return messageDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    return messageDate.toLocaleDateString([], {
      day: "2-digit",
      month: "short",
    });
  };

  // --------------------------------
  // RENDER
  // --------------------------------

  return (
    <main className="chat-page">
      <div className="chat-shell">
        <div className="chat-layout">
          {/* ================================= */}
          {/* SIDEBAR */}
          {/* ================================= */}

          <aside className="chat-sidebar">
            {/* SIDEBAR HEADER */}

            <div className="sidebar-header">
              <div>
                <div className="sidebar-brand">
                  <span className="brand-mark-icon">✦</span>
                  <div>
                    <h1>Ping</h1>
                    {user && <p className="sidebar-meta">Signed in as {user.username}</p>}
                  </div>
                </div>
                <span className="connection-status">
                {connectionStatus === "connected"
                  ? "Connected"
                  : connectionStatus === "reconnecting"
                    ? "Reconnecting..."
                    : connectionStatus === "connecting"
                      ? "Connecting..."
                      : "Disconnected"}
                </span>
              </div>
              <div className="sidebar-actions">
                <ThemeToggle />
                <button
                  type="button"
                  className="logout-button"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            </div>

            <div className="sidebar-search">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearchQuery(value);

                  if (!value.trim()) {
                    setSearchResults([]);
                    setSearchLoading(false);
                  }
                }}
                placeholder="Search username or email"
                aria-label="Search users by username or email"
              />
            </div>

            {/* USER LIST */}

            <div className="chat-users">
              {searchQuery.trim() ? (
                searchLoading ? (
                  <div className="loading-state">Searching...</div>
                ) : searchResults.length === 0 ? (
                  <p className="empty-state">No users found</p>
                ) : (
                  searchResults.map((searchUser) => (
                    <button
                      key={searchUser._id}
                      onClick={() => {
                        selectUser(searchUser);
                        setSearchQuery("");
                      }}
                      className={`chat-user ${
                        selectedUser?._id === searchUser._id
                          ? "chat-user-selected"
                          : ""
                      }`}
                    >
                      <div className="chat-user-row">
                        <div className="avatar">
                          {searchUser.username?.charAt(0).toUpperCase()}
                          {searchUser.isOnline && <span className="online-dot" />}
                        </div>
                        <div className="chat-user-info">
                          <p className="chat-user-name">{searchUser.username}</p>
                          <p className="chat-user-email">{searchUser.email}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )
              ) : loadingUsers ? (
                <div className="loading-state">
                  Loading chats...
                </div>
              ) : users.length === 0 ? (
                <p className="empty-state">
                  No users found
                </p>
              ) : (
                users.map((chatUser) => {
                  const lastMessage =
                    lastMessages[chatUser._id];

                  const unreadCount =
                    unreadCounts[chatUser._id] || 0;

                  return (
                    <button
                      key={chatUser._id}
                      onClick={() =>
                        selectUser(chatUser)
                      }
                      className={`chat-user ${
                        selectedUser?._id ===
                        chatUser._id
                          ? "chat-user-selected"
                          : ""
                      }`}
                    >
                      <div className="chat-user-row">
                        {/* PROFILE IMAGE / AVATAR */}

                        <div className="avatar">
                            {chatUser.username
                              ?.charAt(0)
                              .toUpperCase()}
                          {/* ONLINE DOT */}

                          {chatUser.isOnline && <span className="online-dot" />}
                        </div>

                        {/* USER INFORMATION */}

                        <div className="chat-user-info">
                          {/* USERNAME + TIME */}

                          <div className="chat-user-heading">
                            <p
                              className={`chat-user-name ${
                                unreadCount > 0
                                  ? "font-extrabold"
                                  : ""
                              }`}
                            >
                              {chatUser.username}
                            </p>

                            {/* LAST MESSAGE TIME */}

                            {lastMessage && (
                              <span className="chat-user-time">
                                {formatMessageTime(
                                  lastMessage.createdAt,
                                )}
                              </span>
                            )}
                          </div>

                          {/* LAST MESSAGE + UNREAD COUNT */}

                          <div className="chat-user-preview">
                            <p
                                className={`${
                                    unreadCount > 0
                                  ? "font-extrabold"
                                  : ""
                              }`}
                            >
                              {lastMessage ? (
                                <>
                                  {lastMessage.sender?._id ===
                                    user?.id && "You: "}

                                  {lastMessage.messageType ===
                                  "image" && !lastMessage.isDeleted
                                    ? "📷 Image"
                                    : lastMessage.isDeleted
                                      ? lastMessage.sender?._id === user?.id
                                        ? "You deleted a message"
                                        : "This message was deleted"
                                      : lastMessage.content}
                                </>
                              ) : chatUser.isOnline ? (
                                "Online"
                              ) : (
                                "Currently offline"
                              )}
                            </p>

                            {/* UNREAD BADGE */}

                            {unreadCount > 0 && (
                              <span className="unread-badge">
                                {unreadCount > 99
                                  ? "99+"
                                  : unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* ================================= */}
          {/* CHAT AREA */}
          {/* ================================= */}

          <section className="chat-main">
            {errorMessage && (
              <div className="error-banner">
                {errorMessage}
              </div>
            )}
            {/* ================================= */}
            {/* CHAT HEADER */}
            {/* ================================= */}

            {selectedUser ? (
              <div className="chat-header">
                <div className="avatar">
                  {selectedUser.username?.charAt(0).toUpperCase()}
                  {selectedUser.isOnline && <span className="online-dot" />}
                </div>
                <div>
                <h2 className="font-bold">
                  {selectedUser.username}
                </h2>

                <p>
                  {selectedUser.isOnline
                    ? "Online"
                    : "Currently offline"}
                </p>
                </div>
              </div>
            ) : (
              <div className="chat-header">
                <div>
                  <h2>Select a conversation</h2>
                  <p>Your messages will appear here</p>
                </div>
              </div>
            )}

            {/* ================================= */}
            {/* MESSAGES */}
            {/* ================================= */}

            <div className="chat-messages">
              {/* NO USER SELECTED */}

              {!selectedUser && (
                <div className="empty-state">
                  Select someone to start chatting
                </div>
              )}

              {/* LOADING MESSAGES */}

              {selectedUser && loadingMessages && (
                <div className="loading-state">
                  Loading messages...
                </div>
              )}

              {/* EMPTY CONVERSATION */}

              {selectedUser &&
                !loadingMessages &&
                messages.length === 0 && (
                  <div className="empty-state">
                    No messages yet. Start the conversation
                  </div>
                )}

              {/* MESSAGE LIST */}

              {selectedUser &&
                !loadingMessages &&
                messages.length > 0 &&
                messages.map((msg) => {
                  const isMine =
                    user &&
                    msg.sender?._id === user.id;

                  return (
                    <div
                      key={msg._id}
                      className={`message-row ${
                        isMine
                          ? "message-row-mine"
                          : ""
                      }`}
                    >
                      <div className="message-bubble">
                        {/* SENDER */}

                        <div className="message-meta">
                          <p className="message-sender">
                            {msg.sender?.username}
                            {msg.isEdited && !msg.isDeleted && " · edited"}
                          </p>
                          {isMine && !msg.isDeleted && (
                            <div className="message-actions">
                              {msg.messageType === "text" && (
                                <button
                                  type="button"
                                  onClick={() => startEditingMessage(msg)}
                                  title="Edit message"
                                  aria-label="Edit message"
                                >
                                  ✎
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => deleteMessage(msg._id)}
                                title="Delete message"
                                aria-label="Delete message"
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </div>

                        {/* MESSAGE + STATUS */}

                        <div className="message-content">
                          {msg.isDeleted ? (
                            <p className="deleted-message">
                              {isMine
                                ? "You deleted a message"
                                : "This message was deleted"}
                            </p>
                          ) : msg.messageType === "image" ? (
                            <Image
                              src={`${API_URL}${msg.content}`}
                              alt="Shared image"
                              width={320}
                              height={320}
                              unoptimized
                              className="w-auto h-auto max-w-xs max-h-80 rounded-lg object-cover cursor-pointer hover:opacity-90 transition"
                              onClick={() =>
                                setViewingImage(
                                  `${API_URL}${msg.content}`,
                                )
                              }
                            />
                          ) : (
                            <p>{msg.content}</p>
                          )}

                          {/* MESSAGE STATUS */}

                          {isMine && (
                            <span
                              className="message-status"
                              title={
                                msg.isSeen
                                  ? "Seen"
                                  : msg.isDelivered
                                    ? "Delivered"
                                    : "Sent"
                              }
                            >
                              {msg.isSeen
                                ? "✓✓"
                                : msg.isDelivered
                                  ? "✓✓"
                                  : "✓"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* TYPING INDICATOR */}

              {selectedUser && isTyping && (
                <div className="message-status">
                  {selectedUser.username} is typing...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ================================= */}
            {/* MESSAGE INPUT */}
            {/* ================================= */}

            {selectedUser && (
              <form
                onSubmit={sendMessage}
                className="composer"
              >
                {editingMessage && (
                  <div className="editing-banner">
                    <span>Editing message</span>
                    <button type="button" onClick={cancelEditingMessage}>
                      Cancel
                    </button>
                  </div>
                )}

                {/* IMAGE PREVIEW */}

                {imagePreview && (
                  <div className="mb-3 relative inline-block">
                    <Image
                      src={imagePreview}
                      alt="Selected image"
                      width={128}
                      height={128}
                      unoptimized
                      className="w-32 h-32 object-cover rounded-lg border"
                    />

                    <button
                      type="button"
                      onClick={removeSelectedImage}
                      disabled={isSending}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* INPUT ROW */}

                <div className="composer-row">
                  {/* IMAGE BUTTON */}

                  <label className={`composer-button ${editingMessage ? "composer-control-disabled" : ""}`}>
                    📷

                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      disabled={isSending || Boolean(editingMessage)}
                      className="hidden"
                    />
                  </label>

                  {/* EMOJI BUTTON */}

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setShowEmojiPicker(
                          (previous) => !previous,
                        )
                      }
                      disabled={isSending || Boolean(editingMessage)}
                      className="composer-button"
                    >
                      😊
                    </button>

                    {showEmojiPicker && (
                      <div className="absolute bottom-12 right-0 z-40 w-72 rounded-xl border border-(--line) bg-(--surface) p-3 shadow-lg">
                        <div className="grid grid-cols-8 gap-2 max-h-52 overflow-y-auto">
                          {emojis.map(
                            (emoji, index) => (
                              <button
                                key={`${emoji}-${index}`}
                                type="button"
                                onClick={() =>
                                  addEmoji(emoji)
                                }
                                className="text-xl hover:bg-gray-100 rounded p-1"
                              >
                                {emoji}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* TEXT INPUT */}

                  <input
                    type="text"
                    value={message}
                    onChange={handleTyping}
                    disabled={isSending}
                    placeholder={editingMessage ? "Edit your message..." : "Type a message..."}
                    className="composer-input"
                  />

                  {/* SEND BUTTON */}

                  <button
                    type="submit"
                    disabled={isSending || !socket?.connected}
                    className="send-button"
                  >
                    {editingMessage ? "Save" : isSending ? "Sending..." : "Send"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>

      {/* ================================= */}
      {/* FULL-SCREEN IMAGE VIEWER */}
      {/* ================================= */}

      {viewingImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setViewingImage(null)}
        >
          <button
            type="button"
            onClick={() => setViewingImage(null)}
            className="absolute top-5 right-5 text-white text-3xl hover:opacity-70"
          >
            ✕
          </button>

          <Image
            src={viewingImage}
            alt="Full size"
            width={1200}
            height={800}
            unoptimized
            className="w-auto h-auto max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) =>
              e.stopPropagation()
            }
          />
        </div>
      )}
    </main>
  );
}