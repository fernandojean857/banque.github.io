import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// 1. KREYE PWOJÈ FIREBASE OU EPI METE KONFIGIRASYON AN LA:
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enskripsyon Service Worker pou PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(() => console.log("Service Worker enregistré"));
}

// Eleman UI yo
const authSection = document.getElementById('auth-section');
const dashSection = document.getElementById('dashboard-section');
const balanceDisplay = document.getElementById('balance-display');
const transferMsg = document.getElementById('transfer-msg');

let currentUserDoc = null;

// Siveye si itilizatè a konekte oswa dekonekte
onAuthStateChanged(auth, async (user) => {
    if (user) {
        authSection.classList.remove('active');
        dashSection.classList.add('active');
        loadUserData(user.uid);
    } else {
        dashSection.classList.remove('active');
        authSection.classList.add('active');
    }
});

// Chaje done itilizatè a
async function loadUserData(uid) {
    currentUserDoc = doc(db, 'users', uid);
    const docSnap = await getDoc(currentUserDoc);
    if (docSnap.exists()) {
        balanceDisplay.innerText = docSnap.data().balance.toFixed(2) + " HTG";
    }
}

// Kreye kont
document.getElementById('signup-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCred.user.uid), {
            email: email,
            balance: 0
        });
    } catch (error) { document.getElementById('auth-error').innerText = error.message; }
});

// Konekte
document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { document.getElementById('auth-error').innerText = error.message; }
});

// Dekonekte
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// Depo
document.getElementById('deposit-btn').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('amount').value);
    if (!amount || amount <= 0) return;
    const docSnap = await getDoc(currentUserDoc);
    const newBalance = docSnap.data().balance + amount;
    await updateDoc(currentUserDoc, { balance: newBalance });
    loadUserData(auth.currentUser.uid);
});

// Retrè
document.getElementById('withdraw-btn').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('amount').value);
    if (!amount || amount <= 0) return;
    const docSnap = await getDoc(currentUserDoc);
    if (docSnap.data().balance >= amount) {
        const newBalance = docSnap.data().balance - amount;
        await updateDoc(currentUserDoc, { balance: newBalance });
        loadUserData(auth.currentUser.uid);
    } else { alert("Fonds insuffisants"); }
});

// VIREMENT P2P (Voye kòb bay lòt itilizatè)
document.getElementById('transfer-btn').addEventListener('click', async () => {
    const receiverEmail = document.getElementById('transfer-email').value;
    const amount = parseFloat(document.getElementById('transfer-amount').value);
    transferMsg.style.color = "red";
    
    if (!amount || amount <= 0 || !receiverEmail) {
        transferMsg.innerText = "Informations invalides";
        return;
    }

    if (receiverEmail === auth.currentUser.email) {
        transferMsg.innerText = "Vous ne pouvez pas envoyer d'argent à vous-même";
        return;
    }

    try {
        // Chèche moun nan ak imel li
        const q = query(collection(db, "users"), where("email", "==", receiverEmail));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            transferMsg.innerText = "Utilisateur introuvable";
            return;
        }

        const receiverDocRef = querySnapshot.docs[0].ref;

        // Fè tranzaksyon an an sekirite (Transaction Firestore)
        await runTransaction(db, async (transaction) => {
            const senderDoc = await transaction.get(currentUserDoc);
            const receiverDoc = await transaction.get(receiverDocRef);

            const senderBalance = senderDoc.data().balance;
            if (senderBalance < amount) {
                throw "Fonds insuffisants pour ce virement";
            }

            // Retire kòb sou moun ki voye a epi ajoute l sou moun k ap resevwa a
            transaction.update(currentUserDoc, { balance: senderBalance - amount });
            transaction.update(receiverDocRef, { balance: receiverDoc.data().balance + amount });
        });

        transferMsg.style.color = "#22c55e";
        transferMsg.innerText = "Virement réussi !";
        loadUserData(auth.currentUser.uid);
        
    } catch (error) {
        transferMsg.innerText = error;
    }
});
