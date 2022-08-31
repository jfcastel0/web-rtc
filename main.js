import './style.css'
import { initializeApp } from "firebase/app"
import { getFirestore, collection, addDoc, updateDoc, onSnapshot, getDoc, doc } from "firebase/firestore"

// Firebase/Firestore configuration and initialization
const firebaseConfig = {
  apiKey: "AIzaSyCNmqJuJkR5fxHuX3XpkfB6DPykpgPsbMQ",
  authDomain: "web-rtc-86698.firebaseapp.com",
  projectId: "web-rtc-86698",
  storageBucket: "web-rtc-86698.appspot.com",
  messagingSenderId: "477293016777",
  appId: "1:477293016777:web:d164fca92f4aeae3a3ff18"
}

initializeApp(firebaseConfig)
const db = getFirestore()

// Feather icons initialization
feather.replace()

// Infrastructure setup for webcams and peer connection
const servers = {
  iceServers: [ { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] } ],
  iceCandidatePoolSize: 10
}
let peerConnection = new RTCPeerConnection(servers)
let localStream = null
let remoteStream = null

// Reusable DOM elements
const webcamButton = document.querySelector('#webcamButton')
const localVideo = document.querySelector('#localVideo')
const callButton = document.querySelector('#callButton')
const callInput = document.querySelector('#callInput')
const joinButton = document.querySelector('#joinButton')
const remoteVideo = document.querySelector('#remoteVideo')
const hangupButton = document.querySelector('#hangupButton')
const callOptions = document.querySelector('#callOptions')

// Webcam button click event to allow access and initialize streams
webcamButton.addEventListener('click', async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  remoteStream = new MediaStream()

  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream))

  peerConnection.addEventListener('track', (e) => {
    e.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track))
    callOptions.style.display = 'none'
    hangupButton.style.display = 'block'
  })

  localVideo.srcObject = localStream
  remoteVideo.srcObject = remoteStream

  webcamButton.style.display = 'none'
  callOptions.style.display = 'block'

  // peerConnection.addEventListener('iceconnectionstatechange', (e) => console.log(e))
})

// Event handler to create a new call
callButton.addEventListener('click', async () => {
  const callDoc = await addDoc(collection(db, 'calls'), {})
  const offerCandidates = collection(db, `calls/${callDoc.id}/offerCandidates`)
  const answerCandidates = collection(db, `calls/${callDoc.id}/answerCandidates`)

  peerConnection.addEventListener('icecandidate', async (e) => e.candidate && await addDoc(offerCandidates, e.candidate.toJSON()))

  const offerDescription = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offerDescription)

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type
  }

  await updateDoc(callDoc, { offer })

  onSnapshot(callDoc, (snapshot) => {
    const data = snapshot.data()
    if (!peerConnection.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer)
      peerConnection.setRemoteDescription(answerDescription)
    }
  })

  onSnapshot(answerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data())
        peerConnection.addIceCandidate(candidate)
      }
    })
  })

  const callCode = document.querySelector('#callCode')
  const customInput = document.querySelector('#customInput')
  const orDiv = document.querySelector('#or')

  callButton.style.display = 'none'
  customInput.style.display = 'none'
  orDiv.style.display = 'none'
  callCode.innerHTML += ` ${callDoc.id}`
  callCode.style.display = 'block'
})

// Event handler to join an existing call
joinButton.addEventListener('click', async () => {
  const callID = callInput.value
  const callDoc = await getDoc(doc(db, 'calls', callID))
  const offerCandidates = collection(db, `calls/${callDoc.id}/offerCandidates`)
  const answerCandidates = collection(db, `calls/${callDoc.id}/answerCandidates`)

  peerConnection.addEventListener('icecandidate', async (e) => e.candidate && await addDoc(answerCandidates, e.candidate.toJSON()))

  const callData = (await getDoc(doc(db, 'calls', callID))).data()

  const offerDescription = callData.offer
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offerDescription))

  const answerDescription = await peerConnection.createAnswer()
  await peerConnection.setLocalDescription(answerDescription)

  const answer = {
    sdp: answerDescription.sdp,
    type: answerDescription.type
  }

  await updateDoc(doc(db, 'calls', callID), { answer })

  onSnapshot(offerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const data = change.doc.data()
        peerConnection.addIceCandidate(new RTCIceCandidate(data))
      }
    })
  })
})

// Event handler to end the peer connection
hangupButton.addEventListener('click', () => {
  peerConnection.close()
  localVideo.srcObject = null
  remoteVideo.srcObject = null
})
