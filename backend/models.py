from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import uuid


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_email = Column(String, nullable=False, index=True)
    title = Column(String, default="New Conversation")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    # Per-trip persona
    travelling_as = Column(String, nullable=True)
    travel_style  = Column(String, nullable=True)
    trip_length   = Column(String, nullable=True)
    interests     = Column(String, nullable=True)  # comma-separated
    dietary       = Column(String, nullable=True)  # comma-separated

    # Meetup-specific fields
    meet_location = Column(String, nullable=True)
    meet_time     = Column(String, nullable=True)  # morning | afternoon | evening | night
    meet_date     = Column(String, nullable=True)  # ISO date string or "today"

    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_email = Column(String, primary_key=True)
    display_name = Column(String, nullable=True)
    travel_persona = Column(String, nullable=True)   # solo | family | couple | friends | work
    travel_style = Column(String, nullable=True)     # adventure | relaxed | cultural | foodie | luxury | budget
    trip_length = Column(String, nullable=True)      # weekend | week | twoweeks | month
    interests = Column(String, nullable=True)        # comma-separated: nature,history,food,nightlife,sports,art
    home_city = Column(String, nullable=True)        # overrides geo if set
    onboarded = Column(String, default="false")      # "false" | "true"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class SavedTrip(Base):
    __tablename__ = "saved_trips"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_email = Column(String, nullable=False, index=True)
    conversation_id = Column(String, nullable=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
