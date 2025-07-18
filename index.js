require('dotenv').config();
const port = process.env.PORT || 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors"); //to provide the access to react project
const { type } = require("os");
const { error } = require("console");
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

console.log("Dotenv loaded successfully");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Database Connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log("MongoDB Connected"))
.catch((err) => console.log("MongoDB Connection Error:", err));

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Set up Multer Storage for Cloudinary
const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'ecommerce-images',
        format: async (req, file) => "png", // Convert to PNG
        public_id: (req, file) => `${Date.now()}-${file.originalname.split('.')[0]}`,
        transformation: [
            { width: 500, height: 500, crop: "limit" }
        ]
    },
});
const upload = multer({ 
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

//API creation
app.get("/",(req,res)=>{
    res.send("Express App is Running")
});

//Creating Upload Endpoint for images - FIXED VERSION
app.post("/upload", upload.single("product"), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: "File upload failed - No file received" 
            });
        }

        console.log("File uploaded successfully to Cloudinary:", req.file.path);
        
        // Return the Cloudinary URL, not local path
        res.json({ 
            success: true, 
            image_url: req.file.path // This will be the Cloudinary URL
        });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Upload failed", 
            error: error.message 
        });
    }
});

//schema for creating products
const Product = mongoose.model("Product",{
    id:{
        type: Number,
        required: true,
    },
    name:{
        type: String,
        required: true,
    },
    image:{
        type: String,
        required: true,
    },
    category:{
        type: String,
        required: true,
    },
    new_price:{
        type:Number,
        required:true,
    },
    old_price:{
        type:Number,
        required:true,
    },
    date:{
        type:Date,
        default:Date.now,
    },
    available:{
        type:Boolean,
        default:true,
    },
})

//Creating API for adding products
app.post('/addproduct',async(req,res)=>{
    let products = await Product.find({});
    let id;
    if(products.length>0){
        let last_product_array = products.slice(-1);
        let last_product = last_product_array[0];
        id = last_product.id+1;
    }
    else{
        id = 1;
    }
    const product = new Product({
        id:id,
        name:req.body.name,
        image:req.body.image,
        category:req.body.category,
        new_price:req.body.new_price,
        old_price:req.body.old_price,
    });
    console.log(product);

    //save product in database:
    await product.save();
    console.log("Saved");

    //response in frontend:
    res.json({
        success:true,
        name:req.body.name,
    })
})

//Creating API for deleting products
app.post('/removeproduct',async(req,res)=>{
    await Product.findOneAndDelete({id:req.body.id});
    console.log("Removed");
    res.json({
        success:true,
        name:req.body.name
    })
})

//Creating API for getting all products
app.get('/allproducts',async(req,res)=>{
    let products = await Product.find({});
    console.log("All Products Fetched");

    //response for frontend
    res.send(products);
})

//Schema Creating for user model
const Users = mongoose.model('Users', {
    name:{
        type:String,
    },
    email:{
        type:String,
        unique:true,
    },
    password:{
        type:String,
    },
    cartData:{
        type:Object,
    },
    date:{
        type:Date,
        default:Date.now,
    }
})

//Creating Endpoint for Registering the user
app.post('/signup',async(req,res)=>{
    let check = await Users.findOne({email:req.body.email});
    if (check) {
        return res.status(400).json({success:false,errors:"Existing user found with same email id or email Address"})
    }
    let cart = {};
    for (let i = 0; i < 300; i++) {
        cart[i]=0;        
    }
    const user = new Users({
        name:req.body.username,
        email:req.body.email,
        password:req.body.password,
        cartData:cart,
    })

    //save user in database using save method
    await user.save();

    //use jwt authentication
    const data = {
        user:{
            id:user.id
        }
    }

    //generate token
    const token = jwt.sign(data,'secret_ecom');
    res.json({success:true,token})
})

//Creating endpoint for user login
app.post('/login',async (req,res) => {
    let user = await Users.findOne({email:req.body.email});
    if (user) {
        const passCompare = req.body.password === user.password;
        if (passCompare) {
            const data = {
                user:{
                    id:user.id
                }
            }
            const token = jwt.sign(data,'secret_ecom');
            res.json({success:true,token});
        }
        else{
            res.json({success:false,errors:"Wrong Password"});
        }
    }
    else{
        res.json({success:false,errors:"Wrong Email Id"});
    }
})

//Creating endpoint for New Collection Data
app.get('/newcollections', async (req,res) => {
    let products = await Product.find({});
    let newcollection = products.slice(1).slice(-8);
    console.log("New Collection Fetched");
    res.send(newcollection);
})

//Creating Endpoint for popular in women Category
app.get('/popularinwomen',async (req,res) => {
    let products = await Product.find({category:"women"});
    let popular_women = products.slice(0,4);
    console.log("Popular in Women Fetched");
    res.send(popular_women);
})

//Creating middleware to fetch user
const fetchUser = async (req,res,next) => {
    const token = req.header('auth-token');
    if (!token) {
        res.status(401).send({errors:"Please authenticate using valid token"});
    }
    else{
        try {
            const data = jwt.verify(token,'secret_ecom');
            req.user = data.user;
            next();
        } catch (error) {
            res.status(401).send({errors:"Please authenticate using a valid token"});
        }
    }
}

//Creating endpoint for adding products in cartdata
app.post('/addtocart',fetchUser,async (req,res) => {
    console.log("Added",req.body,req.user);
    let userData = await Users.findOne({_id:req.user.id});
    userData.cartData[req.body.itemId] += 1;
    //save data in mongodb database
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
    res.send("Added")
})

// Creating endpoint to remove product from cartData
app.post('/removefromcart',fetchUser,async (req,res) => {
    console.log("removed",req.body.itemId);
    let userData = await Users.findOne({_id:req.user.id});
    if(userData.cartData[req.body.itemId]>0)
    userData.cartData[req.body.itemId] -= 1;
    //save data in mongodb database
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
    res.send("Removed")
})

//Creating endpoint to get cartData
app.post('/getcartitems',fetchUser,async (req,res) => {
    console.log("Get Cart Items");
    let userData = await Users.findOne({_id:req.user.id});
    res.json(userData.cartData);

})

app.listen(port,(error)=>{
    if (!error) {
        console.log("Server Running on Port:"+ port)
    }
    else{
        console.log("Error:"+error)
    }
})