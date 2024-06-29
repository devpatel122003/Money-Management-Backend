const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();

app.use(cors({
    origin: '*'
}));
app.use(express.json());

const JWT_SECRET = 'your_secure_jwt_secret_key_H3@1*R!T8s^6bL@1wQ2v';

mongoose.connect('mongodb+srv://devpatel2122003:MXAWd1lHquZxXnr0@transactiondata.abth5ol.mongodb.net/?retryWrites=true&w=majority&appName=TransactionData', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Error connecting to MongoDB', err);
});

const expenseSchema = new mongoose.Schema({
    category: String,
    amount: Number,
    type: String,
    dateTime: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    walletAmount: { type: Number, default: 0 },
    bankAmount: { type: Number, default: 0 },
    expenses: [expenseSchema],
});

const User = mongoose.model('User', userSchema);

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        let user = await User.findOne({ username });
        if (!user) {
            const hashedPassword = await bcrypt.hash(password, 10);
            user = new User({ username, password: hashedPassword });
            await user.save();
            return res.json({ message: 'Signup successful', userId: user._id });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'InvalidCredentials' });
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, message: 'Login successful' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'ServerError' });
    }
});

const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'TokenMissing' });
    }
  
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.userId;
      next();
    } catch (error) {
      res.status(401).json({ error: 'InvalidToken' });
    }
};
  
app.get('/api/init', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'UserNotFound' });
        }

        res.json({
            walletAmount: user.walletAmount,
            bankAmount: user.bankAmount,
            expenses: user.expenses,
        });
    } catch (error) {
        console.error('Error fetching initial data:', error);
        res.status(500).send('Error fetching initial data');
    }
});

app.post('/api/wallet', authenticate, async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'UserNotFound' });
        }

        user.walletAmount += amount;
        await user.save();
        res.status(200).send('Money added to wallet successfully');
    } catch (error) {
        console.error('Error adding to wallet:', error);
        res.status(500).send('Error adding to wallet');
    }
});

app.post('/api/bank', authenticate, async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'UserNotFound' });
        }

        user.bankAmount += amount;
        await user.save();
        res.status(200).send('Money added to bank successfully');
    } catch (error) {
        console.error('Error adding to bank:', error);
        res.status(500).send('Error adding to bank');
    }
});

app.post('/api/wallet/undo', authenticate, async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'UserNotFound' });
        }

        user.walletAmount -= amount;
        await user.save();
        res.status(200).send('Money removed from wallet successfully');
    } catch (error) {
        console.error('Error removing from wallet:', error);
        res.status(500).send('Error removing from wallet');
    }
});

app.post('/api/bank/undo', authenticate, async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'UserNotFound' });
        }

        user.bankAmount -= amount;
        await user.save();
        res.status(200).send('Money removed from bank successfully');
    } catch (error) {
        console.error('Error removing from bank:', error);
        res.status(500).send('Error removing from bank');
    }
});

app.post('/api/expenses', authenticate, async (req, res) => {
    try {
        const { category, amount, type } = req.body;
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'UserNotFound' });
        }

        if (type === 'cash' && user.walletAmount < amount) {
            return res.status(400).send('Insufficient wallet funds');
        } else if (type === 'online' && user.bankAmount < amount) {
            return res.status(400).send('Insufficient bank funds');
        }

        user.expenses.push({ category, amount, type });
        if (type === 'cash') {
            user.walletAmount -= amount;
        } else if (type === 'online') {
            user.bankAmount -= amount;
        }

        await user.save();
        res.status(200).json({ expense: user.expenses[user.expenses.length - 1] });
    } catch (error) {
        console.error('Error adding expense:', error);
        res.status(500).send(`Error adding expense: ${error.message}`);
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server started on port ${PORT}`));
