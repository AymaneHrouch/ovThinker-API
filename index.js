const config = require("config");
const { json, urlencoded } = require("express");
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const users = require('./routes/users');
const journals = require('./routes/journals');
const auth = require('./routes/auth');
const authz = require('./middleware/auth');
const { User } = require("./models/user");
app.use(express.json());
app.use(urlencoded({ extended: true }));
app.use('/api/users', users);
app.use('/api/auth', auth)
app.use('/api/journals', journals);

if(!config.get('jwtPrivateKey')) {
    console.error('FATAL ERROR: jwtPrivateKey not defined');
    process.exit(1);
}

mongoose.connect('mongodb://localhost/mini', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB...'))
    .catch(err => console.log(err));

app.get('/register', (req, res) => {
    res.render("register.hbs");
})

app.get('/login', (req, res) => {
    res.render("login.hbs");
})

app.get('/', authz, async (req, res) => {
    let user = await User.findById(req.user._id)
    res.send(`Welcome dear ${user.name}`)
})



app.listen(3000)