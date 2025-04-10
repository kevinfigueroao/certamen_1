import express from "express";
import bodyParser from "body-parser";
import crypto from "node:crypto";
import recordatorios from "./recordatorios.json" assert { type: "json" };
import { randomUUID } from "node:crypto";

const app = express();
const PORT = process.env.PORT ?? 3000;

const users = [
  {
    username: "admin",
    name: "Gustavo Alfredo Marín Sáez",
    clave:
      "1b6ce880ac388eb7fcb6bcaf95e20083:341dfbbe86013c940c8e898b437aa82fe575876f2946a2ad744a0c51501c7dfe6d7e5a31c58d2adc7a7dc4b87927594275ca235276accc9f628697a4c00b4e01", // certamen123
  },
];

let tokenActivo = {};

app.use(express.static("public"));

// Escriba su código a partir de aquí

app.get("/api", (req, res) => {
  res.send("Hola Mundo!");
});

app.use(bodyParser.json()); //????

function generarToken() {
  return crypto.randomBytes(48).toString("hex");
}

// Middleware para verifiar el token

function verificarToken(req, res, next) {
  const token = req.headers["x-authorization"];

  if (!token || !Object.values(tokenActivo).includes(token)) {
    return res.status(401).json({ error: "No autorizado" });
  }

  next();
}

// Función para generar el hash de la contraseña usando scrypt

function generarHashPass(password, salt, keylen = 64) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.toString("hex"));
    });
  });
}

// Ruta para autenticación

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username);

  if (!user) {
    return res.status(401).json({ error: "El usuario no existe" });
  }

  const [storedSalt, storedKey] = user.clave.split(":");

  try {
    const passwordHash = await generarHashPass(password, storedSalt);

    if (passwordHash !== storedKey) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    const token = generarToken();
    tokenActivo[username] = token;

    res.json({ username: user.username, name: user.name, token });
  } catch (err) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

//entrar y listar recordatorios

app.get("/api/reminders", verificarToken, (req, res) => {
  const recordatoriosOrdenados = [...recordatorios].sort((a, b) => {
    if (a.important !== b.important) {
      return b.important - a.important;
    }

    return b.createdAt - a.createdAt;
  });

  res.json(recordatoriosOrdenados);
});

//agregar
app.post("/api/reminders", verificarToken, (req, res) => {
  const { content, important = false } = req.body;

  if (
    typeof content !== "string" ||
    content.trim() === "" ||
    content.length > 120
  ) {
    res.status(400), json({ error: "Error en el contenido" });
  }
  if (typeof important !== "boolean") {
    return res.status(400).json({
      error: "'important' debe ser un valor booleano",
    });
  }

  const nuevoRecordatorio = {
    id: randomUUID(),
    content: content.trim(),
    important,
    createdAt: Date.now(),
  };

  recordatorios.push(nuevoRecordatorio);

  res.status(201).json(nuevoRecordatorio);
});

//borrar

app.delete("/api/reminders/:id", verificarToken, (req, res) => {
  const { id } = req.params;

  const index = recordatorios.findIndex((r) => r.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Recordatorio no encontrado" });
  }
  recordatorios.splice(index, 1);
  res.status(204).send();
});

//modificar
app.patch("/api/reminders/:id", verificarToken, (req, res) => {
  const { id } = req.params;
  const { content, important } = req.body;

  const recordatorio = recordatorios.find((r) => r.id === id);

  if (recordatorio === undefined) {
    return res.status(404).json({
      error: "recordatorio no encontrado",
    });
  }

  if (content !== undefined) {
    if (
      typeof content !== "string" ||
      content.trim() === "" ||
      content.length > 120
    ) {
      return res.status(400).json({
        error:
          "El contenido  no debe estar vacio y debe ser un string de máximo 120 caracteres",
      });
    }

    recordatorio.content = content.trim();
  }

  if (important !== undefined) {
    if (typeof important !== "boolean") {
      return res.status(400).json({
        error: "El campo debe ser boolean",
      });
    }
    recordatorio.important = important;
  }
  return res.json(recordatorio);
});

// Hasta aquís

app.listen(PORT, (error) => {
  if (error) {
    console.error(`No se puede ocupar el puerto ${PORT} :(`);
    return;
  }

  console.log(`Escuchando en el puerto ${PORT}`);
});
