import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import * as api from "@3dverse/api";

dotenv.config();
api.setApiKey(process.env.API_KEY);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("3DVerse backend server is up and running 🚀");
});

const EXISTING_USER_ID = process.env.TEST_USER_ID;

app.post("/api/setup-user", async (req, res) => {
  try {
    if (!EXISTING_USER_ID) {
      throw new Error(
        "TEST_USER_ID is not set. Please define it in your .env file.",
      );
    }

    const { data: userToken } = await api.generateUserToken({
      user_id: EXISTING_USER_ID,
      scope: "manage",
    });

    // Corrigé : listFolders avec objet vide
    const { data: folders } = await api.listFolders({});
    let folder = folders.find((f) => f.name === "my-folder");

    // Si le dossier n'existe pas, on le crée
    if (!folder) {
      const { data: newFolder } = await api.createFolder({ name: "my-folder" });
      folder = newFolder;
    }

    // Donner accès au dossier à l'utilisateur
    await api.grantMemberAccessToFolder({
      member_type: "users",
      folder_id: folder.folder_id,
      member_id: EXISTING_USER_ID,
      access: "manage",
    });

    res.json({
      user_id: EXISTING_USER_ID,
      userToken,
      folder,
    });
  } catch (err) {
    console.error("🚨 Error in /api/setup-user:", err);
    res.status(500).json({
      error: err.message || "Something went wrong",
    });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
