require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session')
// const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./user');

const app = express();

// Accessing the .env file
const port = process.env.PORT;
const uri = process.env.URI;
const secret = process.env.SECRET;

const salt = bcrypt.genSaltSync(10);

// Connecting to MongoDB Atlas 
mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}, () => {
    console.log("Connected to mongoose");
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cors({
    origin: "http://localhost:3000",
    credentials: true
}))
app.use(session({
    secret: secret,
    resave: true,
    saveUninitialized: true
}))
app.use(passport.initialize());
app.use(passport.session());

// Configuring passport
passport.use(new LocalStrategy((username, password, done) => {
    User.findOne({ username: username }, (err, user) => {
        if (err) throw err;
        if (!user) return done(null, false);
        else {
            const isValid = bcrypt.compareSync(password, user.password);
            if (!isValid) return done(null, false);
            return done(null, user);
        };
    })
}))

passport.serializeUser((user, cb) => {
    cb(null, user.id);
});

passport.deserializeUser((id, cb) => {
    User.findById(id, (err, user) => {
        if (err) return cb(err);
        const userInfo = {
            username: user.username,
        };
        cb(null, userInfo);
    })
})

// Register route
app.post('/register', (req, res) => {
    const username = req.body.username;
    if (req.body.password != req.body.confirmPassword) {
        res.send("Passwords do not match");
    } else {
        User.findOne({ username: username }, (err, user) => {
            if (err) throw err;
            if (user) res.send("User already exists");
            else {
                const password = bcrypt.hashSync(req.body.password, salt);
                const newUser = new User({
                    username: username,
                    password: password,
                    requests: {
                        out: [],
                        in: []
                    },
                    friends: [],
                    post: [],
                    replies: []
                })
                newUser.save(err => {
                    if (err) {
                        console.log(err.message);
                    } else {
                        res.send("success");
                    }
                });
            }
        })
    }
    
})

// Login route
app.post('/login', passport.authenticate('local', {failureRedirect: '/login'}), (req, res) => {
    res.send("success");
});

// Logout route
app.post('/logout', (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err); 
      else {
        res.send("success")
      }
    });
  });

// Route to enable protected routes in React
app.get('/user', (req, res) => {
    res.send(req.user);
})

// Route to view and create posts
app.route('/posts')
    .post((req, res) => {
       User.findOne({ username: req.body.author }, (err, user) => {
            if (err) throw err;
            else {
                const newPost = {
                    title: req.body.title,
                    content: req.body.content,
                    author: req.body.author,
                    votes: 0,
                    replies: []
                };
                user.posts.push(newPost);
                user.save();
                res.send("success");
            }
       })
    })
    .get((req, res) => {
        User.findOne({ username: req.user.username }, (err, user) => {
            if (err) throw err;
            else {
                res.send(user.posts)
            }
        })
    })

// Route to send and view friend requests
app.route('/connect')
    .get((req, res) => {
        User.findOne({ username: req.user.username }, (err, user) => {
            if (err) throw err;
            if (user) res.send(user.requests);
        })
    })
    .post((req, res) => {
        requestedUser = req.body;
        currentUser = req.user;
        User.findOne({ username: currentUser.username }, (err, user) => {
            if (err) throw err;
            if (user) {
                user.requests.out.push(requestedUser.username);
                user.save();
                User.findOne( { username: requestedUser.username }, (err, reqUser) => {
                    if (err) throw err;
                    if(reqUser) {
                        reqUser.requests.in.push(currentUser.username);
                        reqUser.save();
                        res.send("Friend request successfully sent");
                    }
                })
            }
        })
    })

// Route to search up users
app.post('/search', (req, res) => {
    const currentUser = req.body.username
    const nameRegex = new RegExp(`^${req.body.name}`, "i")
    User.find({ username: {$in: [nameRegex]} }, (err, users) => {
        if (err) throw err;
        if (users.length > 0) {
            const data = users.map(user => {
                return {username: user.username, friends: user.friends.length}
            })
            res.send(data);
        } else {
            res.send("No search results");
        }
    })
});

// Route to view and manage friends
app.route('/friends')
    .get((req, res) => {
        User.findOne({ username: req.user.username }, (err, user) => {
            if (err) throw err;
            if (user) {
                res.send(user.friends);
            }
        })
    })
    .post((req, res) => {
        const currentUser = req.user.username;
        const otherUser = req.body.username;
        const action = req.body.action;
        if (action === 'add') {
            User.findOne({ username: currentUser }, (err, user) => {
                if (err) throw err;
                if (user) {
                    const newRequestsIn = user.requests.in.filter(item => item != otherUser);
                    user.requests.in = [...newRequestsIn];
                    user.friends.push(otherUser);
                    user.save();
                    User.findOne({ username: otherUser }, (err, other) => {
                        const newRequestsOut = user.requests.out.filter(item => item != currentUser);
                        other.requests.out = [...newRequestsOut];
                        other.friends.push(currentUser);
                        other.save();
                        res.send("Friend request successfully added")
                    })
                }
            })
        } else if (action === "ignore") {
            User.findOne({ username: currentUser }, (err, user) => {
                if (err) throw err;
                if (user) {
                    const newRequestsIn = user.requests.in.filter(item => item != otherUser);
                    user.requests.in = [...newRequestsIn];
                    if (action === "add") {
                        user.friends.push(otherUser);
                    }
                    user.save();
                    User.findOne({ username: otherUser }, (err, other) => {
                        const newRequestsOut = user.requests.out.filter(item => item != currentUser);
                        other.requests.out = [...newRequestsOut];
                        if (action === "add") {
                            other.friends.push(currentUser);
                        }
                        other.save();
                        res.send("Friend request successfully ignored")
                    })
                }
            })
        }  
    })

app.route('/friends/posts')
    .post((req, res) => {
        User.findOne({ username: req.body.username }, (err, user) => {
            res.send(user.posts)
        })
    })   
    
app.route('/reply')
    .post((req, res) => {
        User.findOne({ username: req.body.username }, (err, user) => {
            if (err) throw err;
            if (user) {
                user.posts.forEach(post => {
                    if (post.id === req.body.postId) {
                        post.replies.push({
                            content: req.body.reply,
                            author: req.user.username
                        })
                    }
                });
                user.save();
                res.send("success");
            }
        })
    })

app.listen(port, () => {
    console.log(`Server has started on port ${port}`);
});

