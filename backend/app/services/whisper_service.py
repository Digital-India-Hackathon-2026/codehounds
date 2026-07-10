import logging
import tempfile
import os
from faster_whisper import WhisperModel
from app.core.config import settings

logger = logging.getLogger(__name__)

class WhisperService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(WhisperService, cls).__new__(cls)
            cls._instance.model = None
            cls._instance.is_loaded = False
        return cls._instance

    def __init__(self):
        if not self.is_loaded:
            self.load_model()

    def load_model(self):
        """
        Loads the whisper model only once during startup (Singleton).
        Optimized for CPU via CTranslate2's int8 quantization.
        """
        try:
            from app.core.device import DEVICE
            
            device_str = "cuda" if str(DEVICE) == "cuda" else "cpu"
            # Use 8-bit integer quantization on CPU to speed up inference and save RAM on Render
            compute_type = "int8" if device_str == "cpu" else "float16"
            
            logger.info(f"Loading faster-whisper model '{settings.WHISPER_MODEL}' on {device_str} ({compute_type})...")
            self.model = WhisperModel(
                settings.WHISPER_MODEL,
                device=device_str,
                compute_type=compute_type
            )
            self.is_loaded = True
            logger.info(f"Whisper model '{settings.WHISPER_MODEL}' loaded successfully on {device_str}.")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            self.is_loaded = False

    def _save_temp_audio(self, audio_data: bytes, extension: str = None) -> str:
        """
        Saves binary audio data to a temporary file for whisper decoding.
        Auto-detects format from magic bytes so ffmpeg receives the correct
        container hint (WebM from browser, WAV from file uploads, etc.).
        """
        if extension is None:
            # Detect format from magic bytes
            if audio_data[:4] == b'RIFF' and audio_data[8:12] == b'WAVE':
                extension = ".wav"
            elif audio_data[:4] == b'\x1a\x45\xdf\xa3':
                extension = ".webm"
            elif audio_data[:3] == b'ID3' or audio_data[:2] == b'\xff\xfb':
                extension = ".mp3"
            elif audio_data[:4] == b'OggS':
                extension = ".ogg"
            else:
                extension = ".webm"  # safe default for browser chunks

        fd, temp_path = tempfile.mkstemp(suffix=extension)
        with os.fdopen(fd, 'wb') as f:
            f.write(audio_data)
        return temp_path

    async def transcribe(self, audio_data: bytes) -> str:
        """
        Transcribes audio data to text.
        Supports standard formats via ffmpeg decoding.
        """
        import asyncio
        
        if not audio_data:
            return ""
            
        if not self.is_loaded or self.model is None:
            logger.error("Whisper model is not loaded.")
            return ""

        temp_path = self._save_temp_audio(audio_data)
        try:
            # CPU optimized inference offloaded to background thread
            def sync_transcribe():
                segments, info = self.model.transcribe(temp_path, beam_size=5)
                # Consume the generator to retrieve transcription text
                text = "".join([segment.text for segment in segments])
                return text.strip()
                
            result = await asyncio.to_thread(sync_transcribe)
            return result
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return ""
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    async def detect_language(self, audio_data: bytes) -> str:
        """
        Detects the language of the audio by reading the first 30 seconds.
        """
        import asyncio
        
        if not audio_data or not self.is_loaded or self.model is None:
            return "unknown"
            
        temp_path = self._save_temp_audio(audio_data)
        try:
            def sync_detect():
                # info is returned instantly before segments are consumed
                _, info = self.model.transcribe(temp_path)
                return info.language
                
            detected_lang = await asyncio.to_thread(sync_detect)
            return detected_lang
        except Exception as e:
            logger.error(f"Language detection error: {e}")
            return "unknown"
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
    async def transcribe_chunk(self, audio_data: bytes) -> str:
        """
        Optimized method for transcribing live monitor audio chunks.
        """
        return await self.transcribe(audio_data)

whisper_service = WhisperService()
