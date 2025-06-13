import express from "express"
import "dotenv/config"
import connectDb from "./config/connectdb.js"
import errorMiddleware from "./middleware/error.js"
import userRoute from "./routes/userRoutes.js"
import adminRoute from "./routes/adminRoutes.js"
import bidRoute from "./routes/bidRoutes.js"
import chatRoutes from "./routes/chatRoutes.js"
import notificationRoutes from './routes/notificationRoutes.js';
import repairRequestRoutes from './routes/repairRequestRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import technicianRoutes from './routes/technicianRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express()
const port = process.env.PORT || 4000

app.use(express.json())

app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.originalUrl} ${req.statusCode}`);
    next(); // Proceed to the next middleware/route
  });

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req,res)=>{
    res.send("Api is working fine.")
})
app.use('/api/user', userRoute)
app.use('/api/admin', adminRoute)
app.use('/api/bid', bidRoute)
app.use('/api/chat', chatRoutes)
app.use('/api/notifications', notificationRoutes);
app.use('/api/repair-requests', repairRequestRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/technicians', technicianRoutes);

app.use(errorMiddleware)

app.listen(port, '0.0.0.0', ()=>{
    connectDb()
    console.log(`server is listening on http://localhost:${port}`)
})
