const jwt = require("jsonwebtoken")

const generateToken = (payload, expiresIn = process.env.JWT_EXPIRES_IN || "7d") => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn })
}

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET)
}

const decodeToken = (token) => {
  return jwt.decode(token)
}

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
}
