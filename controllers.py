"""
This file defines actions, i.e. functions the URLs are mapped into
The @action(path) decorator exposed the function at URL:

    http://127.0.0.1:8000/{app_name}/{path}

If app_name == '_default' then simply

    http://127.0.0.1:8000/{path}

If path == 'index' it can be omitted:

    http://127.0.0.1:8000/

The path follows the bottlepy syntax.

@action.uses('generic.html')  indicates that the action uses the generic.html template
@action.uses(session)         indicates that the action uses the session
@action.uses(db)              indicates that the action uses the db
@action.uses(T)               indicates that the action uses the i18n & pluralization
@action.uses(auth.user)       indicates that the action requires a logged in user
@action.uses(auth)            indicates that the action requires the auth object

session, db, T, auth, and tempates are examples of Fixtures.
Warning: Fixtures MUST be declared with @action.uses({fixtures}) else your app will result in undefined behavior
"""

from py4web import action, request, abort, redirect, URL
from yatl.helpers import A
from .common import db, session, T, cache, auth, logger, authenticated, unauthenticated, flash
from py4web.utils.url_signer import URLSigner
from .models import get_user_email

url_signer = URLSigner(session)

@action('default')
@action.uses(db, auth)
def default():
    return redirect(URL('index'))

@action('index')
@action.uses('index.html', db, auth, url_signer)
def index():
    return dict(
        species_url=URL('api/species_by_region', signer=url_signer),
        trends_url=URL('api/species_trends', signer=url_signer),
        contributors_url=URL('api/top_contributors', signer=url_signer),
        check_login_url=URL('api/check_login', signer=url_signer),
    )


@action('api/species_by_region')
@action.uses(db, auth.user)
def species_by_region():
    latitude = request.params.get('latitude')
    longitude = request.params.get('longitude')

    # Avoid redundant checks
    if not latitude or not longitude:
        return dict(error="Latitude and longitude are required")

    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except ValueError:
        return dict(error="Invalid latitude or longitude format")

    species_data = db.executesql("""
        SELECT s.common_name, SUM(s.count) AS total_count
        FROM sighting s
        JOIN checklist c ON s.event_id = c.event_id
        WHERE c.latitude BETWEEN ? AND ?
          AND c.longitude BETWEEN ? AND ?
        GROUP BY s.common_name
        """,
        [latitude - 0.1, latitude + 0.1, longitude - 0.1, longitude + 0.1])
    
    return dict(data=species_data)

@action('api/species_trends')
@action.uses(db, auth.user)  # Enforce login
def species_trends():
    species_name = request.params.get('species_name')
    latitude = request.params.get('latitude')
    longitude = request.params.get('longitude')
    if not species_name or not latitude or not longitude:
        return dict(error="Missing parameters")
    
    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except ValueError:
        return dict(error="Invalid latitude or longitude format")
    
    trends = db.executesql("""
        SELECT c.date, SUM(s.count) AS total_count
        FROM sighting s
        JOIN checklist c ON s.event_id = c.event_id
        WHERE s.common_name = ?
          AND c.latitude BETWEEN ? AND ?
          AND c.longitude BETWEEN ? AND ?
        GROUP BY c.date
        ORDER BY c.date
        """, 
        [species_name, latitude - 0.1, latitude + 0.1, longitude - 0.1, longitude + 0.1])
    
    return dict(data=trends)

@action('api/top_contributors')
@action.uses(db, auth.user)  # Enforce login
def top_contributors():
    latitude = request.params.get('latitude')
    longitude = request.params.get('longitude')
    
    # Log the received parameters
    print(f"INFO: Received API request - Latitude: {latitude}, Longitude: {longitude}")
    
    if not latitude or not longitude:
        return dict(error="Latitude and longitude are required")
    
    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except ValueError:
        return dict(error="Invalid latitude or longitude format")
    
    contributors = db.executesql("""
        SELECT c.observer_id, COUNT(c.event_id) AS checklist_count
        FROM checklist c
        WHERE c.latitude BETWEEN ? AND ?
          AND c.longitude BETWEEN ? AND ?
        GROUP BY c.observer_id
        ORDER BY checklist_count DESC
        LIMIT 5
        """, 
        [latitude - 0.1, latitude + 0.1, longitude - 0.1, longitude + 0.1])
    
    return dict(data=contributors)

@action('api/check_login')
@action.uses(auth)
def check_login():
    logger.info("check_login endpoint accessed")
    user_email = get_user_email()
    return dict(logged_in=user_email is not None)

