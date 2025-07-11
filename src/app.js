import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "./models/user.model.js";
import { googleAuth, googleAuthCallback } from './controllers/user.controller.js';
import userRouter from './routes/user.routes.js';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import session from "express-session";
import studentRouter from './routes/student.routes.js';
import courseRouter from './routes/course.routes.js';
import gradeRouter from './routes/grade.routes.js';
import attendanceRouter from './routes/attendance.routes.js';
import timetableRouter from './routes/timetable.routes.js';
import assignmentRouter from "./routes/assignment.routes.js";
import submissionRouter from "./routes/submission.routes.js";
import feeRouter from './routes/fee.routes.js';

dotenv.config({
  path: "../.env",
});

const app = express();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;

const generateTokens = async (user) => {
  const accessToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1h" });
  const refreshToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "30d" });
  return { accessToken, refreshToken };
};

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: "https://student-management-system-alphame.vercel.app/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ email: profile._json.email });
        if (!user) {
          const lastSixDigitsId = profile.id.substring(profile.id.length - 6);
          const lastTwoDigitsId = profile._json.name.substring(profile._json.name.length - 2);
          const newPass = lastTwoDigitsId + lastSixDigitsId;
          const salt = await bcrypt.genSalt(Number(process.env.SALT));
          const hashedPassword = await bcrypt.hash(newPass, salt);

          user = await User.create({
            fullName: profile._json.name,
            email: profile._json.email,
            is_verified: true,
            username: profile._json.email.split('@')[0],
            password: hashedPassword,
          });
        }

        const { accessToken, refreshToken } = await generateTokens(user);
        return done(null, { user, accessToken, refreshToken });
      } catch (error) {
        console.error("Error during authentication:", error);
        return done(error);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
}));

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));

app.use(passport.initialize());
app.use(passport.session());

// google auth 
app.get('/auth/google', googleAuth);
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), googleAuthCallback);


// routes
app.use("/api/v1/users", userRouter);
app.use("/api/v1/students", studentRouter);
app.use("/api/v1/courses", courseRouter);
app.use("/api/v1/grades", gradeRouter);
app.use("/api/v1/attendance", attendanceRouter);
app.use("/api/v1/timetable", timetableRouter);
app.use("/api/v1/assignments", assignmentRouter);
app.use("/api/v1/submissions", submissionRouter);
app.use("/api/v1/fees", feeRouter);



app.get('/', (req, res) => {
    res.send("Server is live");
  });

export { app };