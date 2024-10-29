// app.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

// MongoDB 連接
const connectDB = async () => {
  try {
    await mongoose.connect(`${process.env.MONGO_URL}/${process.env.DB_NAME}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

// 定義 Schema
const ItemSchema = new mongoose.Schema({
  item: String,          // 英文單字
  correct: String,       // 正確中文答案
  wrong: [String],       // 錯誤的中文答案陣列
  category: String       // 單字類別
});

const LeaderboardSchema = new mongoose.Schema({
  playerName: String,  // 新增玩家名字欄位
  score: Number,
  date: { type: Date, default: Date.now }
});

const Item = mongoose.model('Item', ItemSchema, 'items');
const Leaderboard = mongoose.model('Leaderboard', LeaderboardSchema, 'leaderboard');

app.use(express.json());
app.use(express.static('public'));

// API 路由
app.get('/api/questions', async (req, res) => {
  try {
    const questions = await Item.find({});
    
    if (!questions || questions.length === 0) {
      console.log('沒有找到題目');
      return res.status(404).json({ error: 'No questions found' });
    }

    // 轉換資料格式並打亂題目順序
    const formattedQuestions = questions.map(q => {
      if (!q.item || !q.correct || !Array.isArray(q.wrong)) {
        console.log('資料格式不正確:', q);
        return null;
      }
      return {
        question: q.item,
        answers: [q.correct, ...q.wrong],
        correctAnswer: q.correct,
        item: q.item // 保留英文單字以便顯示正確答案
      };
    }).filter(q => q !== null);
    
    // 打亂題目順序
    for (let i = formattedQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [formattedQuestions[i], formattedQuestions[j]] = [formattedQuestions[j], formattedQuestions[i]];
    }
    
    res.json(formattedQuestions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Error fetching questions' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await Leaderboard.find()
      .sort({ score: -1 })
      .limit(10);
    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Error fetching leaderboard' });
  }
});

app.post('/api/leaderboard', async (req, res) => {
  try {
    const newScore = new Leaderboard({
      playerName: req.body.playerName || '匿名',  // 如果沒有提供名字，使用"匿名"
      score: req.body.score
    });
    await newScore.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving score:', error);
    res.status(500).json({ error: 'Error saving score' });
  }
});

// 取得總遊戲次數
app.get('/api/total-plays', async (req, res) => {
  try {
    const totalPlays = await Leaderboard.countDocuments();
    res.json({ totalPlays });
  } catch (error) {
    console.error('Error fetching total plays:', error);
    res.status(500).json({ error: 'Error fetching total plays' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// 優雅關閉程序
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing HTTP server and MongoDB connection');
  mongoose.connection.close();
  process.exit(0);
});