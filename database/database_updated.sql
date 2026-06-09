ALTER TABLE favorites_routes
ADD CONSTRAINT FK_favorites_routes_users
FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE favorites_routes
ADD CONSTRAINT FK_favorites_routes_bus_routes
FOREIGN KEY (route_id) REFERENCES bus_routes(route_code);

ALTER TABLE favorites_places
ADD CONSTRAINT FK_favorites_places_users
FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE favorites_places
ADD CONSTRAINT FK_favorites_places_tourist_places
FOREIGN KEY (place_id) REFERENCES tourist_places(id);

ALTER TABLE chat_history
ADD CONSTRAINT FK_chat_history_users
FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE chat_history
ADD CONSTRAINT FK_chat_history_tourist_places
FOREIGN KEY (related_place_id) REFERENCES tourist_places(id);

ALTER TABLE chat_history
ADD CONSTRAINT FK_chat_history_bus_routes
FOREIGN KEY (related_route_id) REFERENCES bus_routes(route_code);



ALTER TABLE dbo.chatbot_knowledge
ALTER COLUMN province_code NVARCHAR(20) NULL;

ALTER TABLE dbo.chatbot_knowledge
ADD CONSTRAINT FK_chatbot_knowledge_provinces
FOREIGN KEY (province_code) REFERENCES dbo.provinces(code);


IF NOT EXISTS (
    SELECT 1 
    FROM sys.foreign_keys 
    WHERE name = 'FK_community_reviews_users'
)
BEGIN
    ALTER TABLE dbo.community_reviews
    ADD CONSTRAINT FK_community_reviews_users
    FOREIGN KEY (user_id) REFERENCES dbo.users(id);
END
GO