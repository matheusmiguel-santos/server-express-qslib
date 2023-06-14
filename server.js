const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mysql = require('mysql');
const mercadopago = require('mercadopago');
const twilio = require('twilio');


const accountSid = 'AC70ff9c698a1bd034555f3ba4d29c7750'; // Seu Account SID da Twilio
const authToken = 'aa4e96f3f419b68df5843f38ec7a19d5'; // Seu Auth Token da Twilio
const client = twilio(accountSid, authToken);

let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'miguel.matheus@hotmail.com',
    pass: 'Mustang2019#'
  }
});

const app = express();

const db = mysql.createPool({
  host: '129.148.55.118',
  user: 'QualityAdmin',
  password: 'Suus0220##',
  database: 'qualityseg_db',
  connectionLimit: 10,
});

db.getConnection((err, connection) => {
  if (err) throw err;
  console.log('Conectado ao banco de dados MySQL');
  connection.release();
});

app.use(cors());
app.use(express.json());


app.post('/login', (req, res) => {
  const { usuario, senha } = req.body;

  const query = 'SELECT * FROM cadastro WHERE usuario = ?';
  db.query(query, [usuario], (err, results) => {
   
    if (err) {
      console.error('Error querying the database: ', err);
      return res.send({ success: false, message: err.message });
    }
    if (results.length === 0) {
      return res.send({ success: false, message: 'User not found' });
    }
    const user = results[0];
    console.log('User found in database: ', user);

    if (senha !== user.senha) {
      return res.send({ success: false, message: 'Wrong password' });
    }
    
    const token = jwt.sign({ id: user.id }, 'suus02201998##', { expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true });
    
    // inclua o nome do usuário na resposta
    res.send({ success: true, username: user.usuario, token });
    
  });
});


app.delete('/deleteAll', (req, res) => {
  const query = 'DELETE FROM cadastro';
  db.query(query, (err, result) => {
    if (err) {
      console.log(err);
      return res.send({ success: false, message: 'Falha ao excluir registros: ' + err.message });
    }

    if (result.affectedRows > 0) {
      res.send({ success: true, message: `${result.affectedRows} registro(s) foram excluídos.` });
    } else {
      res.send({ success: false, message: 'Não há registros para excluir.' });
    }
  });
});


app.post('/register', (req, res) => {
  const { usuario, senha } = req.body;

  const query = 'INSERT INTO cadastro (usuario, senha) VALUES (?, ?)';
  db.query(query, [usuario, senha], (err, result) => {
    
    if (err) {
      console.log(err);
      return res.send({ success: false, message: err.message });
    }

    res.send({ success: true });
  });
});


mercadopago.configure({
  access_token: 'TEST-2684905602430236-052513-51d07b1caa42a7938ab7e2a9f13a7f98-135153905',
});

app.post('/create_preference', async (req, res) => {
  const { title, price, quantity, email } = req.body;

  const preference = {
    items: [
      {
        title,
        unit_price: Number(price),
        quantity: Number(quantity),
      },
    ],
    payer: {
      email,
    },
    additional_info: JSON.stringify({ title, email }), // Armazene os detalhes do curso e o e-mail do usuário aqui
  };

  try {
    const response = await mercadopago.preferences.create(preference);
    
    // Enviar um e-mail para o usuário com os nomes dos cursos que ele comprou
    let mailOptions = {
      from: 'miguel.matheus@hotmail.com',
      to: 'miguel.matheus@hotmail.com', // use o seu e-mail aqui
      subject: 'Confirmação de Compra',
      text: `O usuário com o e-mail ${email} comprou os seguintes cursos: ${title}. O valor total do pagamento é ${price * quantity}.`
    };

    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });

    res.json({ id: response.body.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/webhook', (req, res) => {
  const paymentId = req.query.id;
  // Aqui você pode processar a notificação do pagamento.
  // Por exemplo, você pode buscar os detalhes do pagamento usando o Mercado Pago SDK:
  mercadopago.payment.findById(paymentId).then(payment => {
    // Aqui você tem os detalhes do pagamento.
    // Você pode verificar o status do pagamento e agir de acordo.
    if (payment.status === 'approved') {
      // O pagamento foi aprovado
      // Você pode, por exemplo, enviar um e-mail para o usuário com os detalhes dos cursos que ele comprou.
      
      // Adicione o seguinte código para enviar uma mensagem para o WhatsApp
      const message = `O usuário com o e-mail ${payment.additional_info.email} comprou os seguintes cursos: ${payment.additional_info.title}. O valor total do pagamento é ${payment.transaction_amount}. ID da compra: ${payment.id}.`;
      client.messages
        .create({
          body: message,
          from: 'whatsapp:+14155238886', // Número do WhatsApp da Twilio
          to: 'whatsapp:+5514998141078'  // Seu número de WhatsApp
        })
        .then(message => console.log(message.sid))
        .catch(err => console.error(err));
    }
  }).catch(err => {
    console.error('Erro ao buscar detalhes do pagamento: ', err);
  });
  // Responda com um status 200 para indicar ao Mercado Pago que você recebeu a notificação.
  res.status(200).end();
});


const port = process.env.PORT || 5000;

app.listen(port, () => console.log(`Server is running on port ${port}`));