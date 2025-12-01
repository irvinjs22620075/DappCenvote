import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Import Models
import User from './models/User.js';
import Candidate from './models/Candidate.js';
import Survey from './models/Survey.js';
import Vote from './models/Vote.js';

dotenv.config();

async function testConnection() {
    console.log('🔍 Testing MongoDB Connection...\n');

    // Check environment variable
    console.log('📋 Environment Variables:');
    console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ Not Set');
    console.log('MONGODB_URI value:', process.env.MONGODB_URI || 'undefined');
    console.log();

    if (!process.env.MONGODB_URI) {
        console.error('❌ MONGODB_URI is not defined in .env file');
        process.exit(1);
    }

    try {
        // Connect to MongoDB with proper options
        console.log('🔌 Attempting to connect to MongoDB...');

        const options = {
            retryWrites: true,
            w: 'majority',
            ssl: true,
            tls: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        };

        await mongoose.connect(process.env.MONGODB_URI, options);
        console.log('✅ Successfully connected to MongoDB');
        console.log(`📊 Database: ${mongoose.connection.name}\n`);

        // Test collections
        console.log('📊 Testing Collections:');

        // Users
        const userCount = await User.countDocuments();
        console.log(`👥 Users: ${userCount} documents`);
        if (userCount > 0) {
            const sampleUsers = await User.find().limit(3);
            console.log('   Sample users:', sampleUsers.map(u => ({ id: u._id, username: u.username })));
        }

        // Candidates
        const candidateCount = await Candidate.countDocuments();
        console.log(`🎯 Candidates: ${candidateCount} documents`);
        if (candidateCount > 0) {
            const sampleCandidates = await Candidate.find().limit(3);
            console.log('   Sample candidates:', sampleCandidates.map(c => ({ id: c._id, name: c.name })));
        }

        // Surveys
        const surveyCount = await Survey.countDocuments();
        console.log(`📋 Surveys: ${surveyCount} documents`);
        if (surveyCount > 0) {
            const sampleSurveys = await Survey.find().limit(3);
            console.log('   Sample surveys:', sampleSurveys.map(s => ({ id: s._id, title: s.title })));
        }

        // Votes
        const voteCount = await Vote.countDocuments();
        console.log(`🗳️  Votes: ${voteCount} documents`);

        console.log('\n✅ All tests completed successfully!');

    } catch (error) {
        console.error('\n❌ Error during testing:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        if (error.cause) {
            console.error('Error cause:', error.cause);
        }
        console.error('\nFull error:', error);
    } finally {
        // Close connection
        await mongoose.connection.close();
        console.log('\n🔌 Connection closed');
        process.exit(0);
    }
}

testConnection();
