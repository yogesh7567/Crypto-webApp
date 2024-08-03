const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const cryptoAlerts = [];

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Schedule cron job to run every minute
cron.schedule('* * * * *', async () => {
  for (const alert of cryptoAlerts) {
    try {
      const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: alert.crypto,
          vs_currencies: 'usd'
        }
      });

      const currentPrice = data[alert.crypto]?.usd;

      if (currentPrice) {
        const conditionMet = (alert.limitType === 'up' && currentPrice >= alert.upLimit) ||
                             (alert.limitType === 'down' && currentPrice <= alert.downLimit) ||
                             (alert.limitType === 'both' && (currentPrice >= alert.upLimit || currentPrice <= alert.downLimit));

        if (conditionMet && !alert.notified) {
          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: alert.email,
            subject: `Crypto Price Alert: ${alert.crypto}`,
            html: `
              <html>
                <body>
                  <p style="font-size: 20px; font-weight: bold;">Hello,</p>
                  <p style="font-size: 18px;">Your price alert for <strong>${alert.crypto}</strong> has been triggered!</p>
                  <p style="font-size: 18px;">Current Price: <strong>$${currentPrice}</strong></p>
                  <p style="font-size: 18px;">Alert Details:</p>
                  <ul style="font-size: 18px;">
                    <li><strong>Alert Type:</strong> ${alert.limitType.charAt(0).toUpperCase() + alert.limitType.slice(1)}</li>
                    <li><strong>Up Limit:</strong> $${alert.upLimit || 'N/A'}</li>
                    <li><strong>Down Limit:</strong> $${alert.downLimit || 'N/A'}</li>
                  </ul>
                  <p style="font-size: 18px;">The current price has ${alert.limitType === 'up' ? 'reached or exceeded' : 'dropped below'} the set limit.</p>
                  <p style="font-size: 18px;">Thank you for using our service!</p>
                  <p style="font-size: 18px;">Best regards,<br>Crypto Price Tracker Team</p>
                </body>
              </html>`
          };

          await transporter.sendMail(mailOptions);

          // Set notified flag to true
          alert.notified = true;
        }
      }
    } catch (error) {
      console.error('Error fetching price or sending email:', error);
    }
  }
});

app.post('/set-alert', async (req, res) => {
  const { crypto, limitType, upLimit, downLimit, email } = req.body;
  if (crypto && limitType && email) {
    cryptoAlerts.push({ crypto, limitType, upLimit, downLimit, email, notified: false });

    const confirmationMailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Alert Confirmation for ${crypto}`,
      html: `
        <html>
          <body>
            <p style="font-size: 20px; font-weight: bold;">Hello,</p>
            <p style="font-size: 18px;">Your alert for <strong>${crypto}</strong> has been successfully set!</p>
            <p style="font-size: 18px;">Alert Details:</p>
            <ul style="font-size: 18px;">
              <li><strong>Alert Type:</strong> ${limitType.charAt(0).toUpperCase() + limitType.slice(1)}</li>
              <li><strong>Up Limit:</strong> $${upLimit || 'N/A'}</li>
              <li><strong>Down Limit:</strong> $${downLimit || 'N/A'}</li>
            </ul>
            <p style="font-size: 18px;">We will notify you when the price meets the specified criteria.</p>
            <p style="font-size: 18px;">Thank you for using our service!</p>
            <p style="font-size: 18px;">Best regards,<br>Crypto Price Tracker Team</p>
          </body>
        </html>`
    };

    try {
      await transporter.sendMail(confirmationMailOptions);
      res.status(200).send('Alert set and confirmation email sent successfully');
    } catch (error) {
      console.error('Error sending confirmation email:', error);
      res.status(500).send('Alert set but failed to send confirmation email');
    }
  } else {
    res.status(400).send('Invalid data');
  }
});

// New route to fetch detailed cryptocurrency data
app.get('/crypto/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching data from CoinGecko:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
