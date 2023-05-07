const express = require('express');
const router = express.Router();
const Datastore = require('nedb');
const session = require('express-session');
const bcrypt = require('bcrypt');

const usersDB = new Datastore({ filename: 'users.db', autoload: true });
const goalsDB = new Datastore({ filename: 'goals.db', autoload: true });
const achievementsDB = new Datastore({ filename: 'achievements.db', autoload: true });

router.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

// Home page
router.get('/', (req, res) => {
    const loggedIn = !!req.session.userId;
    res.render('home', { loggedIn });
});

// About Us page
router.get('/about', (req, res) => {
    const loggedIn = !!req.session.userId;
    res.render('about', { loggedIn });
});

// User registration
router.get('/register', (req, res) => {
    const loggedIn = !!req.session.userId;
    res.render('user/register', { loggedIn });
});

router.post('/register', (req, res) => {
    const { username, password } = req.body;
    console.log(`Attempting to register user: ${username}`);

    // Check if the user already exists
    usersDB.findOne({ username }, async (err, existingUser) => {
        if (err) {
            console.error(`Error during user registration: ${err}`);
            res.status(500).send('Error registering user');
        } else if (existingUser) {
            console.warn(`User already exists: ${username}`);
            res.status(409).send('User already exists');
        } else {
            // Hash the password
            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                usersDB.insert({ username, password: hashedPassword }, (err, newUser) => {
                    if (err) {
                        console.error(`Error during user registration: ${err}`);
                        res.status(500).send('Error registering user');
                    } else {
                        console.log(`Successfully registered user: ${username}`);
                        res.redirect('/login');
                    }
                });
            } catch (err) {
                console.error(`Error hashing password: ${err}`);
                res.status(500).send('Error registering user');
            }
        }
    });
});


// User login
router.get('/login', (req, res) => {
    const loggedIn = !!req.session.userId;
    res.render('user/login', { loggedIn });
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    console.log(`Attempting to log in user: ${username}`);

    usersDB.findOne({ username }, async (err, user) => {
        if (err) {
            console.error(`Error during login: ${err}`);
            res.status(500).send('Error during login');
        } else if (!user) {
            console.warn(`Invalid username or password for user: ${username}`);
            res.status(401).send('Invalid username or password');
        } else {
            // Verify password
            try {
                const isPasswordCorrect = await bcrypt.compare(password, user.password);
                if (isPasswordCorrect) {
                    console.log(`Successful login for user: ${username}`);
                    req.session.userId = user._id;
                    res.redirect('/dashboard');
                } else {
                    console.warn(`Invalid username or password for user: ${username}`);
                    res.status(401).send('Invalid username or password');
                }
            } catch (err) {
                console.error(`Error verifying password: ${err}`);
                res.status(500).send('Error during login');
            }
        }
    });
});


// View information about nutrition, fitness, and a healthy lifestyle
router.get('/dashboard', (req, res) => {
    if (!req.session.userId) {
        res.redirect('/login');
    } else {
        const loggedIn = !!req.session.userId;
        res.render('dashboard', { loggedIn });
    }
});

// Goals page
router.get('/goals', (req, res) => {
    if (!req.session.userId) {
        res.redirect('/login');
    } else {
        goalsDB.find({ userId: req.session.userId }, (err, goals) => {
            if (err) {
                res.status(500).send('Error retrieving goals');
            } else {
                const loggedIn = !!req.session.userId;
                res.render('goals', { loggedIn, goals });
            }
        });
    }
});

// Define personal goals
router.post('/goals', (req, res) => {
    if (!req.session.userId) {
        res.redirect('/login');
    } else {
        const { category, description, dueDate } = req.body;
        const goal = { userId: req.session.userId, category, description, dueDate };
        goalsDB.insert(goal, (err, newGoal) => {
            if (err) {
                res.status(500).send('Error adding goal');
            } else {
                res.redirect('/dashboard');
            }
        });
    }
});

// Add, remove, and modify personal goals
router.put('/goals/:goalId', (req, res) => {
    if (!req.session.userId) {
        res.redirect('/login');
    } else {
        const { goalId } = req.params;
        const { category, description, dueDate } = req.body;
        const updatedGoal = { category, description, dueDate };
        goalsDB.update({ _id: goalId, userId: req.session.userId }, { $set: updatedGoal }, {}, (err, numReplaced) => {
            if (err || numReplaced === 0) {
                res.status(500).send('Error updating goal');
            } else {
                res.redirect('/dashboard');
            }
        });
    }
});

router.delete('/goals/:goalId', (req, res) => {
    if (!req.session.userId) {
        res.redirect('/login');
    } else {
        const { goalId } = req.params;
        goalsDB.remove({ _id: goalId, userId: req.session.userId }, {}, (err, numRemoved) => {
            if (err || numRemoved === 0) {
                res.status(500).send('Error deleting goal');
            } else {
                res.redirect('/dashboard');
            }
        });
    }
});

// Record personal achievements
router.post('/achievements', (req, res) => {
    if (!req.session.userId) {
        res.redirect('/login');
    } else {
        const { goalId, timestamp, details } = req.body;
        const achievement = { userId: req.session.userId, goalId, timestamp, details };
        achievementsDB.insert(achievement, (err, newAchievement) => {
            if (err) {
                res.status(500).send('Error recording achievement');
            } else {
                res.redirect('/dashboard');
            }
        });
    }
});

// Review personal achievements history
router.get('/achievements', (req, res) => {
    if (!req.session.userId) {
        res.redirect('/login');
    } else {
        achievementsDB.find({ userId: req.session.userId }, (err, achievements) => {
            if (err) {
                res.status(500).send('Error retrieving achievements');
            } else {
                const loggedIn = !!req.session.userId;
                res.render('achievements', { loggedIn, achievements });
            }
        });
    }
});

// User logout
router.get('/logout', (req, res) => {
    if (req.session) {
        // Destroy the session and remove the userId
        req.session.destroy((err) => {
            if (err) {
                console.error(`Error during logout: ${err}`);
                res.status(500).send('Error during logout');
            } else {
                // Redirect to the home page after logout
                res.redirect('/');
            }
        });
    } else {
        res.redirect('/');
    }
});


module.exports = router;